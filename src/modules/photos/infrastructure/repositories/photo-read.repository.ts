import { AttributeSource, BibReadingStatus, PhotoStatus, Prisma } from '@generated/prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import type {
  GalleryFacetsProjection,
  PhotoDetailProjection,
  PhotoListBib,
  PhotoListProjection,
  PhotoViewProjection,
  SimilarPhotoProjection,
} from '@photos/application/projections'
import type { SearchPhotosFilters } from '@photos/application/queries'
import type { Photo } from '@photos/domain/entities'
import {
  CORRECTION_REPOSITORY,
  type GalleryBibFilter,
  type GallerySort,
  type ICorrectionRepository,
  type IGalleryFilters,
  type IPhotoReadRepository,
  type ReviewQueueStatusFilter,
} from '@photos/domain/ports'

import { PaginatedResult, type Pagination } from '@shared/application'
import type { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { PrismaService } from '@shared/infrastructure'
import {
  type IStorageAdapter,
  STORAGE_ADAPTER,
} from '@shared/storage/domain/ports/storage-adapter.port'
import * as PhotoMapper from '../mappers/photo.mapper'

const ES_TO_EN_COLOR: Record<string, string> = {
  rojo: 'red',
  naranja: 'orange',
  amarillo: 'yellow',
  verde: 'green',
  azul: 'blue',
  celeste: 'cyan',
  morado: 'purple',
  rosa: 'pink',
  fucsia: 'magenta',
  marron: 'brown',
  negro: 'black',
  gris: 'gray',
  blanco: 'white',
  dorado: 'gold',
  plateado: 'silver',
}

const expandColorVariants = (input: string[]): string[] => {
  return input
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
    .flatMap((c) => {
      const en = ES_TO_EN_COLOR[c]
      return en ? [c, en] : [c]
    })
}

@Injectable()
export class PhotoReadRepository implements IPhotoReadRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cdn: CdnUrlBuilder,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
    @Inject(CORRECTION_REPOSITORY) private readonly correctionRepo: ICorrectionRepository,
  ) {}

  /** Finds a photo by ID (no soft-delete filter — photos use hard delete). */
  async findById(id: string): Promise<Photo | null> {
    const record = await this.prisma.photo.findUnique({ where: { id } })
    return record ? PhotoMapper.toEntity(record) : null
  }

  /** Like `findById`, but an id outside `scope` resolves to `null` — the tenant-boundary check. */
  async findByIdInScope(id: string, scope: EventScope): Promise<Photo | null> {
    const record = await this.prisma.photo.findFirst({ where: { id, event: scope.toPrisma() } })
    return record ? PhotoMapper.toEntity(record) : null
  }

  /** Checks if a photo already exists for a given event and filename. */
  async existsByEventAndFilename(eventId: string, filename: string): Promise<boolean> {
    const record = await this.prisma.photo.findFirst({
      where: { event_id: eventId, filename },
      select: { id: true },
    })
    return record !== null
  }

  /** Retrieves a paginated page of an event's photos under the gallery's filters. */
  async getPhotosList(
    eventId: string,
    pagination: Pagination,
    filters: IGalleryFilters,
    scope: EventScope,
  ): Promise<PaginatedResult<PhotoListProjection>> {
    const where: Prisma.PhotoWhereInput = { event_id: eventId, event: scope.toPrisma() }

    if (filters.classified === true) where.status = PhotoStatus.reviewed
    if (filters.classified === false) where.status = { not: PhotoStatus.reviewed }
    if (filters.uncategorized) where.photo_category_id = null
    else if (filters.photoCategoryId) where.photo_category_id = filters.photoCategoryId

    const bibWhere = this.bibFilterWhere(filters.bib)
    if (bibWhere) Object.assign(where, bibWhere)

    const idSets = await Promise.all([
      filters.sale ? this.soldPhotoIds(eventId) : Promise.resolve(null),
      filters.plateNumber
        ? this.findPhotoIdsMatchingBibDigits(filters.plateNumber, filters.bibMatch ?? 'exact')
        : Promise.resolve(null),
    ])

    const [soldIds, matchIds] = idSets

    if (soldIds !== null) {
      if (filters.sale === 'sold') where.id = { in: soldIds }
      else where.id = { notIn: soldIds }
    }
    if (matchIds !== null) {
      const list = [...matchIds]
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { id: { in: list } }]
    }

    if (filters.sort === 'no_bib_first' || filters.sort === 'bib_asc') {
      const orderedIds = await this.orderedIdsForBibSort(where, filters.sort)
      const total = orderedIds.length
      const slice = orderedIds.slice(pagination.skip, pagination.skip + pagination.take)

      if (slice.length === 0) return new PaginatedResult([], total, pagination)

      const photos = await this.prisma.photo.findMany({
        where: { id: { in: slice } },
        select: PhotoMapper.photoListSelectConfig,
      })
      const byId = new Map(photos.map((p) => [p.id, p]))
      const ordered = slice
        .map((id) => byId.get(id))
        .filter((p): p is (typeof photos)[number] => !!p)

      return new PaginatedResult(await this.enrichListProjections(ordered), total, pagination)
    }

    const [photos, total] = await Promise.all([
      this.prisma.photo.findMany({
        where,
        select: PhotoMapper.photoListSelectConfig,
        orderBy: this.gallerySortOrder(filters.sort),
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.photo.count({ where }),
    ])

    return new PaginatedResult(await this.enrichListProjections(photos), total, pagination)
  }

  /** Event-wide counts for the gallery's filter panel, unaffected by the active filters. */
  async getGalleryFacets(eventId: string, scope: EventScope): Promise<GalleryFacetsProjection> {
    const [row] = await this.prisma.$queryRaw<
      Array<{
        total: number
        without_bib: number
        doubtful: number
        corrected: number
        uncategorized: number
        sold: number
      }>
    >(Prisma.sql`
      WITH live AS (
        SELECT p.id, p.photo_category_id
        FROM photos p
        JOIN events e ON e.id = p.event_id
        WHERE p.event_id = ${eventId}::uuid ${eventScopeFilter(scope, 'e')}
      ),
      corr AS (
        SELECT DISTINCT c.photo_id
        FROM corrections c
        JOIN live ON live.id = c.photo_id
        WHERE c.target_type = 'photo_bib' AND c.field = 'digits'
      ),
      bib AS (
        SELECT pb.photo_id,
               bool_or(pb.source = 'reviewer') AS reviewer,
               bool_and(pb.source = 'ai' AND pb.status = 'abstained') AS all_weak
        FROM photo_bibs pb
        JOIN live ON live.id = pb.photo_id
        WHERE pb.deleted_at IS NULL
        GROUP BY pb.photo_id
      ),
      sold AS (
        SELECT DISTINCT oi.photo_id
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN live ON live.id = oi.photo_id
        WHERE o.status IN ('paid', 'delivered')
      )
      SELECT
        (SELECT count(*)::int FROM live) AS total,
        (SELECT count(*)::int FROM live WHERE id NOT IN (SELECT photo_id FROM bib)) AS without_bib,
        (SELECT count(*)::int FROM bib
           WHERE NOT reviewer AND all_weak AND photo_id NOT IN (SELECT photo_id FROM corr)
        ) AS doubtful,
        (SELECT count(*)::int FROM live
           WHERE id IN (SELECT photo_id FROM corr)
              OR id IN (SELECT photo_id FROM bib WHERE reviewer)
        ) AS corrected,
        (SELECT count(*)::int FROM live WHERE photo_category_id IS NULL) AS uncategorized,
        (SELECT count(*)::int FROM sold) AS sold
    `)

    const categories = await this.prisma.photo.groupBy({
      by: ['photo_category_id'],
      where: { event_id: eventId, event: scope.toPrisma(), photo_category_id: { not: null } },
      _count: { _all: true },
    })

    const names = new Map(
      (
        await this.prisma.photoCategory.findMany({
          where: { id: { in: categories.map((c) => c.photo_category_id as number) } },
          select: { id: true, name: true },
        })
      ).map((c) => [c.id, c.name]),
    )

    return {
      total: row.total,
      withoutBib: row.without_bib,
      withBib: row.total - row.without_bib,
      doubtfulBib: row.doubtful,
      correctedBib: row.corrected,
      uncategorized: row.uncategorized,
      sold: row.sold,
      unsold: row.total - row.sold,
      categories: categories
        .flatMap((c) => {
          const id = c.photo_category_id as number
          const name = names.get(id)
          return name === undefined ? [] : [{ id, name, count: c._count._all }]
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    }
  }

  /** Prisma fragment for the four bib predicates; null means "no bib filter". */
  private bibFilterWhere(bib: GalleryBibFilter | undefined): Prisma.PhotoWhereInput | null {
    if (!bib) return null
    if (bib === 'none') return { bibs: { none: { deleted_at: null } } }
    if (bib === 'any') return { bibs: { some: { deleted_at: null } } }
    if (bib === 'corrected') {
      return {
        OR: [
          { bibs: { some: { deleted_at: null, source: AttributeSource.reviewer } } },
          { corrections: { some: { target_type: 'photo_bib', field: 'digits' } } },
        ],
      }
    }
    // doubtful: read by the model, below its own threshold, and nobody has touched it since
    return {
      AND: [
        { bibs: { some: { deleted_at: null } } },
        { NOT: { bibs: { some: { deleted_at: null, source: AttributeSource.reviewer } } } },
        { NOT: { corrections: { some: { target_type: 'photo_bib', field: 'digits' } } } },
        {
          bibs: {
            every: {
              OR: [
                { deleted_at: { not: null } },
                { source: AttributeSource.ai, status: BibReadingStatus.abstained },
              ],
            },
          },
        },
      ],
    }
  }

  /**
   * `id` is the tie-break, not decoration: 10,980 of 11,000 photos share an `uploaded_at` with at
   * least one sibling, in groups of up to 20. Without a total order Postgres may return tied rows in
   * a different sequence per request, so a photo can appear on two pages or on none while paging.
   */
  private gallerySortOrder(sort: GallerySort | undefined): Prisma.PhotoOrderByWithRelationInput[] {
    if (sort === 'filename') return [{ filename: 'asc' }, { id: 'asc' }]
    return [{ uploaded_at: 'desc' }, { id: 'asc' }]
  }

  /** Photo ids of an event that sit in a paid or delivered order. */
  private async soldPhotoIds(eventId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ photo_id: string }>>(Prisma.sql`
      SELECT DISTINCT oi.photo_id
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN photos p ON p.id = oi.photo_id
      WHERE p.event_id = ${eventId}::uuid AND o.status IN ('paid', 'delivered')
    `)
    return rows.map((r) => r.photo_id)
  }

  /** Ordered photo ids for the two sorts that depend on bib data. */
  private async orderedIdsForBibSort(
    where: Prisma.PhotoWhereInput,
    sort: 'no_bib_first' | 'bib_asc',
  ): Promise<string[]> {
    const ids = (
      await this.prisma.photo.findMany({
        where,
        select: { id: true },
        orderBy: [{ uploaded_at: 'desc' }, { id: 'asc' }],
      })
    ).map((r) => r.id)
    if (ids.length === 0) return []

    const rows = await this.prisma.$queryRaw<Array<{ id: string; rank: string | null }>>(Prisma.sql`
      SELECT p.id,
             MIN(NULLIF(regexp_replace(
               CASE WHEN latest.has_correction THEN latest.corrected_value ELSE pb.digits END,
               -- '\\D' is doubled on purpose: inside a JS template literal '\D' collapses to 'D',
               -- which would strip the letter D instead of every non-digit. Verified against the database.
               '\\D', '', 'g'), '')::bigint)::text AS rank
      FROM photos p
      LEFT JOIN photo_bibs pb ON pb.photo_id = p.id AND pb.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT new_value AS corrected_value, TRUE AS has_correction
        FROM corrections
        WHERE target_type = 'photo_bib' AND target_id = pb.id AND field = 'digits'
        ORDER BY corrected_at DESC LIMIT 1
      ) latest ON TRUE
      WHERE p.id = ANY(${ids}::uuid[])
      GROUP BY p.id
    `)

    const rankOf = new Map(rows.map((r) => [r.id, r.rank === null ? null : Number(r.rank)]))

    return ids.slice().sort((a, b) => {
      const ra = rankOf.get(a) ?? null
      const rb = rankOf.get(b) ?? null
      if (sort === 'no_bib_first') {
        if (ra === null && rb !== null) return -1
        if (ra !== null && rb === null) return 1
        return 0
      }
      if (ra === null && rb === null) return 0
      if (ra === null) return 1
      if (rb === null) return -1
      return ra - rb
    })
  }

  /** Attaches effective bibs, category and sold flag to a page of photo rows. */
  async enrichListProjections(rows: PhotoMapper.PhotoListSelect[]): Promise<PhotoListProjection[]> {
    if (rows.length === 0) return []

    const ids = rows.map((r) => r.id)

    const [bibRows, soldRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          photo_id: string
          digits: string
          source: 'ai' | 'reviewer'
          confidence: string | null
          status: 'read' | 'abstained' | null
          corrected: boolean
        }>
      >(Prisma.sql`
        SELECT
          pb.photo_id,
          COALESCE(CASE WHEN latest.has_correction THEN latest.corrected_value END, pb.digits) AS digits,
          pb.source::text AS source,
          pb.confidence::text AS confidence,
          pb.status::text AS status,
          COALESCE(latest.has_correction, FALSE) AS corrected
        FROM photo_bibs pb
        LEFT JOIN LATERAL (
          SELECT new_value AS corrected_value, TRUE AS has_correction
          FROM corrections
          WHERE target_type = 'photo_bib' AND target_id = pb.id AND field = 'digits'
          ORDER BY corrected_at DESC LIMIT 1
        ) latest ON TRUE
        WHERE pb.deleted_at IS NULL AND pb.photo_id = ANY(${ids}::uuid[])
        ORDER BY pb.created_at ASC
      `),
      this.prisma.$queryRaw<Array<{ photo_id: string }>>(Prisma.sql`
        SELECT DISTINCT oi.photo_id
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.photo_id = ANY(${ids}::uuid[])
          AND o.status IN ('paid', 'delivered')
      `),
    ])

    const bibsByPhoto = bibRows.reduce((acc, r) => {
      const list = acc.get(r.photo_id) ?? []
      list.push({
        digits: r.digits,
        source: r.source,
        confidence: r.confidence === null ? null : Number(r.confidence),
        status: r.status,
        corrected: r.corrected,
      })
      acc.set(r.photo_id, list)
      return acc
    }, new Map<string, PhotoListBib[]>())

    const soldIds = new Set(soldRows.map((r) => r.photo_id))

    return rows.map((r) =>
      PhotoMapper.toListProjection(r, this.cdn, bibsByPhoto.get(r.id) ?? [], soldIds.has(r.id)),
    )
  }

  /** Retrieves a single photo's detail by ID. */
  async getPhotoDetail(id: string, scope: EventScope): Promise<PhotoDetailProjection | null> {
    const record = await this.prisma.photo.findFirst({
      where: { id, event: scope.toPrisma() },
      select: PhotoMapper.photoDetailSelectConfig,
    })
    if (!record) return null

    const projection = await PhotoMapper.toDetailProjection(
      record,
      this.cdn,
      this.storage,
      this.correctionRepo,
    )
    return this.enrichDetailProjection(record, projection)
  }

  /** Retrieves a single photo's detail by public slug (admin/operator). */
  async getPhotoDetailBySlug(
    slug: string,
    scope: EventScope,
  ): Promise<PhotoDetailProjection | null> {
    const record = await this.prisma.photo.findFirst({
      where: { public_slug: slug, event: scope.toPrisma() },
      select: PhotoMapper.photoDetailSelectConfig,
    })
    if (!record) return null

    const projection = await PhotoMapper.toDetailProjection(
      record,
      this.cdn,
      this.storage,
      this.correctionRepo,
    )
    return this.enrichDetailProjection(record, projection)
  }

  /**
   * Attaches paid/delivered orders, the photo's rank within its event, and the corrector's
   * name per bib onto an already-built detail projection.
   */
  async enrichDetailProjection(
    record: PhotoMapper.PhotoDetailSelect,
    projection: PhotoDetailProjection,
  ): Promise<PhotoDetailProjection> {
    const photoId = record.id
    const eventId = record.event_id

    const [orderRows, windowRows, correctorRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ id: string; buyer_name: string; created_at: Date; status: string }>
      >(
        Prisma.sql`
        SELECT o.id,
               COALESCE(NULLIF(TRIM(CONCAT(o.snap_first_name, ' ', o.snap_last_name)), ''), u.email) AS buyer_name,
               o.created_at,
               o.status::text AS status
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN users u ON u.id = o.user_id
        WHERE oi.photo_id = ${photoId}::uuid AND o.status IN ('paid', 'delivered')
        ORDER BY o.created_at DESC
      `,
      ),
      this.prisma.$queryRaw<
        Array<{
          position: number
          total: number
          prev_slug: string | null
          next_slug: string | null
        }>
      >(Prisma.sql`
        WITH ranked AS (
          SELECT id, public_slug,
                 ROW_NUMBER() OVER (ORDER BY uploaded_at DESC, id ASC)::int AS rn,
                 LAG(public_slug) OVER (ORDER BY uploaded_at DESC, id ASC) AS prev_slug,
                 LEAD(public_slug) OVER (ORDER BY uploaded_at DESC, id ASC) AS next_slug,
                 COUNT(*) OVER ()::int AS total
          FROM photos WHERE event_id = ${eventId}::uuid
        )
        SELECT rn AS position, total, prev_slug, next_slug FROM ranked WHERE id = ${photoId}::uuid
      `),
      this.prisma.$queryRaw<Array<{ bib_id: string; name: string }>>(Prisma.sql`
        SELECT pb.id AS bib_id,
               COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS name
        FROM photo_bibs pb
        LEFT JOIN LATERAL (
          SELECT reviewer_id FROM corrections
          WHERE target_type = 'photo_bib' AND target_id = pb.id AND field = 'digits'
          ORDER BY corrected_at DESC LIMIT 1
        ) latest ON TRUE
        JOIN users u ON u.id = COALESCE(latest.reviewer_id, pb.created_by_id)
        WHERE pb.photo_id = ${photoId}::uuid AND pb.deleted_at IS NULL
      `),
    ])

    const [windowRow] = windowRows
    const correctorByBibId = new Map(correctorRows.map((r) => [r.bib_id, r.name]))

    return {
      ...projection,
      orders: orderRows.map((r) => ({
        id: r.id,
        buyerName: r.buyer_name,
        createdAt: r.created_at,
        status: r.status,
      })),
      position: windowRow?.position ?? 1,
      eventPhotoCount: windowRow?.total ?? 1,
      previousSlug: windowRow?.prev_slug ?? null,
      nextSlug: windowRow?.next_slug ?? null,
      bibs: projection.bibs.map((b) => ({
        ...b,
        correctedByName: correctorByBibId.get(b.id) ?? null,
      })),
    }
  }

  /** Retrieves a lightweight photo view by public slug. */
  async getPhotoViewBySlug(slug: string, scope: EventScope): Promise<PhotoViewProjection | null> {
    const record = await this.prisma.photo.findFirst({
      where: { public_slug: slug, event: scope.toPrisma() },
      select: PhotoMapper.photoViewSelectConfig,
    })

    return record ? PhotoMapper.toViewProjection(record, this.cdn) : null
  }

  /** Searches photos across events with multi-criteria filtering. */
  async searchPhotos(
    filters: SearchPhotosFilters,
    pagination: Pagination,
    scope: EventScope,
  ): Promise<PaginatedResult<PhotoListProjection>> {
    const matchedIds = await this.findPhotoIdsByAttributeFilters(filters)
    if (matchedIds !== null && matchedIds.length === 0) {
      return new PaginatedResult<PhotoListProjection>([], 0, pagination)
    }

    const where = this.buildSearchWhere(filters)
    where.event = scope.toPrisma()
    if (matchedIds !== null) where.id = { in: matchedIds }

    const [photos, total] = await Promise.all([
      this.prisma.photo.findMany({
        where,
        select: PhotoMapper.photoListSelectConfig,
        orderBy: { filename: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.photo.count({ where }),
    ])

    return new PaginatedResult(await this.enrichListProjections(photos), total, pagination)
  }

  /** Returns the total file size (in bytes) for a single event's photos. */
  async getTotalFileSizeByEvent(eventId: string): Promise<number> {
    const result = await this.prisma.photo.aggregate({
      where: { event_id: eventId },
      _sum: { file_size: true },
    })
    return Number(result._sum.file_size ?? 0)
  }

  /** Batch: returns a map of eventId → total file size in bytes. */
  async getTotalFileSizesByEventIds(eventIds: string[]): Promise<Map<string, number>> {
    if (eventIds.length === 0) return new Map()

    const results = await this.prisma.photo.groupBy({
      by: ['event_id'],
      where: { event_id: { in: eventIds } },
      _sum: { file_size: true },
    })

    return new Map(results.map((r) => [r.event_id, Number(r._sum.file_size ?? 0)]))
  }

  /** Counts photos inside `scope` (all of them for an unrestricted/platform caller). */
  async countAll(scope: EventScope): Promise<number> {
    return this.prisma.photo.count({ where: { event: scope.toPrisma() } })
  }

  /** Counts photos inside `scope` that no operator has marked reviewed yet. */
  async countPendingReview(scope: EventScope): Promise<number> {
    return this.prisma.photo.count({
      where: { event: scope.toPrisma(), status: { not: PhotoStatus.reviewed } },
    })
  }

  /** Returns the sum of file sizes (bytes) for photos inside `scope`. */
  async sumAllFileSize(scope: EventScope): Promise<number> {
    const result = await this.prisma.photo.aggregate({
      where: { event: scope.toPrisma() },
      _sum: { file_size: true },
    })
    return Number(result._sum.file_size ?? 0)
  }

  /** Returns the count of reviewed (formerly: classified) photos for a single event. */
  async getClassifiedCountByEvent(eventId: string): Promise<number> {
    return this.prisma.photo.count({
      where: { event_id: eventId, status: PhotoStatus.reviewed },
    })
  }

  /** Batch: returns a map of eventId → reviewed photo count. */
  async getClassifiedCountsByEventIds(eventIds: string[]): Promise<Map<string, number>> {
    if (eventIds.length === 0) return new Map()

    const results = await this.prisma.photo.groupBy({
      by: ['event_id'],
      where: { event_id: { in: eventIds }, status: PhotoStatus.reviewed },
      _count: { id: true },
    })

    return new Map(results.map((r) => [r.event_id, r._count.id]))
  }

  /** Returns all photo keys for an event, ordered by filename. Used for download manifest. */
  async getAllPhotoKeysForEvent(
    eventId: string,
    scope: EventScope,
  ): Promise<Array<{ filename: string; storageKey: string; fileSize: number }>> {
    const photos = await this.prisma.photo.findMany({
      where: { event_id: eventId, event: scope.toPrisma() },
      orderBy: { filename: 'asc' },
      select: { filename: true, storage_key: true, file_size: true },
    })
    return photos.map((p) => ({
      filename: p.filename,
      storageKey: p.storage_key,
      fileSize: Number(p.file_size),
    }))
  }

  /** Returns the first non-reviewed photo and its page number for resume functionality. */
  async getResumePoint(
    eventId: string,
    limit: number,
    scope: EventScope,
  ): Promise<{ photoId: string | null; page: number }> {
    const firstUnclassified = await this.prisma.photo.findFirst({
      where: { event_id: eventId, event: scope.toPrisma(), status: { not: PhotoStatus.reviewed } },
      orderBy: { filename: 'asc' },
      select: { id: true, filename: true },
    })

    if (!firstUnclassified) return { photoId: null, page: 1 }

    const position = await this.prisma.photo.count({
      where: { event_id: eventId, filename: { lt: firstUnclassified.filename } },
    })

    return { photoId: firstUnclassified.id, page: Math.floor(position / limit) + 1 }
  }

  /** Counts how many of the given IDs exist. */
  async countByIds(ids: string[]): Promise<number> {
    return this.prisma.photo.count({ where: { id: { in: ids } } })
  }

  /** Counts how many of the given IDs belong to a specific event and are processed or reviewed. */
  async countByIdsAndEvent(photoIds: string[], eventId: string): Promise<number> {
    return this.prisma.photo.count({
      where: {
        id: { in: photoIds },
        event_id: eventId,
        status: { in: [PhotoStatus.processed, PhotoStatus.reviewed] },
      },
    })
  }

  /** Distinct in-scope event ids among `photoIds`, so bulk mutations needn't trust the id list. */
  async getDistinctEventIdsForPhotoIds(photoIds: string[], scope: EventScope): Promise<string[]> {
    if (photoIds.length === 0) return []

    const rows = await this.prisma.photo.findMany({
      where: { id: { in: photoIds }, event: scope.toPrisma() },
      select: { event_id: true },
      distinct: ['event_id'],
    })
    return rows.map((r) => r.event_id)
  }

  /** Finds visually similar photos using vector cosine similarity. */
  async findSimilar(
    photoId: string,
    eventId: string,
    limit: number,
  ): Promise<SimilarPhotoProjection[]> {
    const embeddingRows = await this.prisma.$queryRawUnsafe<Array<{ embedding: unknown }>>(
      'SELECT "embedding" FROM "photos" WHERE "id" = $1::uuid AND "embedding" IS NOT NULL',
      photoId,
    )

    if (embeddingRows.length === 0) return []

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string
        filename: string
        public_slug: string
        similarity: number
        has_classifications: boolean
      }>
    >(
      `SELECT p.id, p.filename, p.public_slug,
        1 - (p.embedding <=> (SELECT embedding FROM photos WHERE id = $1::uuid)) as similarity,
        EXISTS(SELECT 1 FROM photo_bibs pb WHERE pb.photo_id = p.id AND pb.deleted_at IS NULL) as has_classifications
      FROM photos p
      WHERE p.event_id = $2::uuid
        AND p.id != $1::uuid
        AND p.embedding IS NOT NULL
      ORDER BY p.embedding <=> (SELECT embedding FROM photos WHERE id = $1::uuid)
      LIMIT $3`,
      photoId,
      eventId,
      limit,
    )

    return rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      publicSlug: row.public_slug,
      thumbnailUrl: this.cdn.internalUrl(row.public_slug, 'thumb'),
      similarity: Number(row.similarity),
      hasClassifications: row.has_classifications,
    }))
  }

  /** Retrieves the review queue for an event with bib/color counts and min bib confidence. */
  async getReviewQueue(params: {
    eventSlug: string
    status: ReviewQueueStatusFilter
    limit: number
    offset: number
    scope: EventScope
  }): Promise<{
    items: Array<{
      id: string
      publicSlug: string
      filename: string
      status: PhotoStatus
      reviewedAt: Date | null
      minBibConfidence: number | null
      bibsCount: number
      colorsCount: number
    }>
    total: number
  }> {
    const { eventSlug, status, limit, offset, scope } = params
    const reviewedFilter = reviewedAtFilter(status)
    // e.slug is unique, so this join is a single row already — the predicate can't change
    // cardinality.
    const scopeFilter = eventScopeFilter(scope, 'e')

    type Row = {
      id: string
      public_slug: string
      filename: string
      status: PhotoStatus
      reviewed_at: Date | null
      min_bib_confidence: number | string | null
      bibs_count: bigint
      colors_count: bigint
    }

    const items = await this.prisma.$queryRaw<Row[]>`
      SELECT p.id, p.public_slug, p.filename, p.status, p.reviewed_at,
             (SELECT MIN(confidence) FROM photo_bibs WHERE photo_id = p.id AND deleted_at IS NULL) AS min_bib_confidence,
             (SELECT COUNT(*)::bigint FROM photo_bibs WHERE photo_id = p.id AND deleted_at IS NULL) AS bibs_count,
             (SELECT COUNT(*)::bigint FROM photo_colors WHERE photo_id = p.id AND deleted_at IS NULL) AS colors_count
      FROM photos p
      INNER JOIN events e ON e.id = p.event_id
      WHERE e.slug = ${eventSlug}
        AND p.status IN ('processed'::photo_status, 'reviewed'::photo_status, 'failed'::photo_status)
        ${reviewedFilter}
        ${scopeFilter}
      ORDER BY (SELECT MIN(confidence) FROM photo_bibs WHERE photo_id = p.id AND deleted_at IS NULL) ASC NULLS FIRST,
               p.uploaded_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `

    const totalRow = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM photos p
      INNER JOIN events e ON e.id = p.event_id
      WHERE e.slug = ${eventSlug}
        AND p.status IN ('processed'::photo_status, 'reviewed'::photo_status, 'failed'::photo_status)
        ${reviewedFilter}
        ${scopeFilter}
    `

    return {
      items: items.map((r) => ({
        id: r.id,
        publicSlug: r.public_slug,
        filename: r.filename,
        status: r.status,
        reviewedAt: r.reviewed_at,
        minBibConfidence: r.min_bib_confidence === null ? null : Number(r.min_bib_confidence),
        bibsCount: Number(r.bibs_count),
        colorsCount: Number(r.colors_count),
      })),
      total: Number(totalRow[0]?.count ?? 0),
    }
  }

  async getReviewQueueByEventIds(params: {
    eventIds: string[]
    status: ReviewQueueStatusFilter
    limit: number
    offset: number
  }) {
    const { eventIds, status, limit, offset } = params
    const reviewedFilter = reviewedAtFilter(status)

    if (eventIds.length === 0) return { items: [], total: 0 }

    type Row = {
      id: string
      public_slug: string
      filename: string
      status: PhotoStatus
      reviewed_at: Date | null
      min_bib_confidence: number | string | null
      bibs_count: bigint
      colors_count: bigint
      event_id: string
    }

    const items = await this.prisma.$queryRaw<Row[]>`
      SELECT p.id, p.public_slug, p.filename, p.status, p.reviewed_at,
             p.event_id,
             (SELECT MIN(confidence) FROM photo_bibs WHERE photo_id = p.id AND deleted_at IS NULL) AS min_bib_confidence,
             (SELECT COUNT(*)::bigint FROM photo_bibs WHERE photo_id = p.id AND deleted_at IS NULL) AS bibs_count,
             (SELECT COUNT(*)::bigint FROM photo_colors WHERE photo_id = p.id AND deleted_at IS NULL) AS colors_count
      FROM photos p
      WHERE p.event_id = ANY(${eventIds}::uuid[])
        AND p.status IN ('processed'::photo_status, 'reviewed'::photo_status, 'failed'::photo_status)
        ${reviewedFilter}
      ORDER BY (SELECT MIN(confidence) FROM photo_bibs WHERE photo_id = p.id AND deleted_at IS NULL) ASC NULLS FIRST,
               p.uploaded_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `

    const totalRow = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM photos p
      WHERE p.event_id = ANY(${eventIds}::uuid[])
        AND p.status IN ('processed'::photo_status, 'reviewed'::photo_status, 'failed'::photo_status)
        ${reviewedFilter}
    `

    return {
      items: items.map((r) => ({
        id: r.id,
        publicSlug: r.public_slug,
        filename: r.filename,
        status: r.status,
        reviewedAt: r.reviewed_at,
        minBibConfidence: r.min_bib_confidence != null ? Number(r.min_bib_confidence) : null,
        bibsCount: Number(r.bibs_count),
        colorsCount: Number(r.colors_count),
        eventId: r.event_id,
      })),
      total: Number(totalRow[0].count),
    }
  }

  /**
   * Resolves bib/color filters to a set of matching photo ids, taking
   * the latest correction into account. Returns `null` when no attribute
   * filter is present (caller should not narrow by id). An empty array
   * means "no photo matches any filter combination" — caller short-circuits.
   */
  private async findPhotoIdsByAttributeFilters(
    filters: SearchPhotosFilters,
  ): Promise<string[] | null> {
    const hasBib = !!filters.plateNumber
    const helmet = filters.helmetColor ? expandColorVariants(filters.helmetColor.split(',')) : []
    const clothing = filters.clothingColor
      ? expandColorVariants(filters.clothingColor.split(','))
      : []
    const bike = filters.bikeColor ? expandColorVariants(filters.bikeColor.split(',')) : []

    if (!hasBib && helmet.length === 0 && clothing.length === 0 && bike.length === 0) return null

    const idSets: Array<Set<string>> = []

    if (hasBib) {
      idSets.push(
        await this.findPhotoIdsMatchingBibDigits(
          filters.plateNumber as string,
          filters.bibMatch ?? 'exact',
        ),
      )
    }
    if (helmet.length > 0) idSets.push(await this.findPhotoIdsMatchingColor('helmet', helmet))
    if (clothing.length > 0)
      idSets.push(await this.findPhotoIdsMatchingColor('cyclist_clothes', clothing))
    if (bike.length > 0) idSets.push(await this.findPhotoIdsMatchingColor('bicycle', bike))

    if (idSets.length === 0) return null
    const [first, ...rest] = idSets
    return [...first].filter((id) => rest.every((s) => s.has(id)))
  }

  /** Returns photo ids whose effective (latest-correction) bib digits match. */
  private async findPhotoIdsMatchingBibDigits(
    value: string,
    match: 'exact' | 'starts' | 'contains',
  ): Promise<Set<string>> {
    const escaped = value.replace(/[\\%_]/g, (c) => `\\${c}`)
    const pattern =
      match === 'starts' ? `${escaped}%` : match === 'contains' ? `%${escaped}%` : escaped

    const sql =
      match === 'exact'
        ? Prisma.sql`
            SELECT DISTINCT pb.photo_id
            FROM photo_bibs pb
            LEFT JOIN LATERAL (
              SELECT new_value AS corrected_value, TRUE AS has_correction
              FROM corrections
              WHERE target_type = 'photo_bib' AND target_id = pb.id AND field = 'digits'
              ORDER BY corrected_at DESC LIMIT 1
            ) latest ON TRUE
            WHERE pb.deleted_at IS NULL
              AND LOWER(
                CASE WHEN latest.has_correction THEN latest.corrected_value ELSE pb.digits END
              ) = LOWER(${value})
          `
        : Prisma.sql`
            SELECT DISTINCT pb.photo_id
            FROM photo_bibs pb
            LEFT JOIN LATERAL (
              SELECT new_value AS corrected_value, TRUE AS has_correction
              FROM corrections
              WHERE target_type = 'photo_bib' AND target_id = pb.id AND field = 'digits'
              ORDER BY corrected_at DESC LIMIT 1
            ) latest ON TRUE
            WHERE pb.deleted_at IS NULL
              AND (
                CASE WHEN latest.has_correction THEN latest.corrected_value ELSE pb.digits END
              ) ILIKE ${pattern} ESCAPE '\\'
          `

    const rows = await this.prisma.$queryRaw<Array<{ photo_id: string }>>(sql)
    return new Set(rows.map((r) => r.photo_id))
  }

  /** Returns photo ids whose effective (latest-correction) color matches in the given region. */
  private async findPhotoIdsMatchingColor(
    region: 'helmet' | 'cyclist_clothes' | 'bicycle',
    colorsLower: string[],
  ): Promise<Set<string>> {
    if (colorsLower.length === 0) return new Set()

    const lower = colorsLower.map((c) => c.toLowerCase())

    const rows = await this.prisma.$queryRaw<Array<{ photo_id: string }>>(Prisma.sql`
      SELECT DISTINCT pc.photo_id
      FROM photo_colors pc
      LEFT JOIN LATERAL (
        SELECT new_value AS corrected_value, TRUE AS has_correction
        FROM corrections
        WHERE target_type = 'photo_color' AND target_id = pc.id AND field = 'primary_color'
        ORDER BY corrected_at DESC LIMIT 1
      ) latest ON TRUE
      WHERE pc.deleted_at IS NULL
        AND pc.region = ${region}::"ColorRegion"
        AND LOWER(
          CASE WHEN latest.has_correction THEN latest.corrected_value ELSE pc.primary_color END
        ) = ANY(${lower}::text[])
    `)

    return new Set(rows.map((r) => r.photo_id))
  }

  /** Builds a Prisma where clause from search filters (non-attribute filters only). */
  private buildSearchWhere(filters: SearchPhotosFilters): Prisma.PhotoWhereInput {
    const where: Prisma.PhotoWhereInput = {}

    if (filters.eventId) where.event_id = filters.eventId
    if (filters.status) where.status = filters.status as Prisma.EnumPhotoStatusFilter

    if (filters.fromDate || filters.toDate) {
      where.uploaded_at = {}
      if (filters.fromDate) where.uploaded_at.gte = filters.fromDate
      if (filters.toDate) where.uploaded_at.lte = filters.toDate
    }

    return where
  }
}

function reviewedAtFilter(status: ReviewQueueStatusFilter): Prisma.Sql {
  if (status === 'pending') return Prisma.sql`AND p.reviewed_at IS NULL`
  if (status === 'reviewed') return Prisma.sql`AND p.reviewed_at IS NOT NULL`
  return Prisma.empty
}

/**
 * Raw-SQL equivalent of `EventScope.toPrisma()`, for queries that join `events` directly. `alias`
 * is interpolated unescaped via `Prisma.raw`, so it must never come from user input.
 */
function eventScopeFilter(scope: EventScope, alias: string): Prisma.Sql {
  if (scope.all) return Prisma.empty
  return Prisma.sql`AND (${Prisma.raw(alias)}.tenant_id = ANY(${scope.tenantIds}::uuid[]) OR ${Prisma.raw(alias)}.id = ANY(${scope.eventIds}::uuid[]))`
}
