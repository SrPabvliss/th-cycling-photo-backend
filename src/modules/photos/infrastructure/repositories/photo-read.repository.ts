import { PhotoStatus, Prisma } from '@generated/prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import type {
  PhotoDetailProjection,
  PhotoListProjection,
  PhotoViewProjection,
  SimilarPhotoProjection,
} from '@photos/application/projections'
import type { SearchPhotosFilters } from '@photos/application/queries'
import type { Photo } from '@photos/domain/entities'
import {
  CORRECTION_REPOSITORY,
  type ICorrectionRepository,
  type IPhotoReadRepository,
  type ReviewQueueStatusFilter,
} from '@photos/domain/ports'

import { PaginatedResult, type Pagination } from '@shared/application'
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

  /** Checks if a photo already exists for a given event and filename. */
  async existsByEventAndFilename(eventId: string, filename: string): Promise<boolean> {
    const record = await this.prisma.photo.findFirst({
      where: { event_id: eventId, filename },
      select: { id: true },
    })
    return record !== null
  }

  /** Retrieves a paginated list of photos for a given event. */
  async getPhotosList(
    eventId: string,
    pagination: Pagination,
    classified?: boolean,
    photoCategoryId?: number,
  ): Promise<PaginatedResult<PhotoListProjection>> {
    const where: Prisma.PhotoWhereInput = { event_id: eventId }
    if (classified === true) where.status = PhotoStatus.reviewed
    if (classified === false) where.status = { not: PhotoStatus.reviewed }
    if (photoCategoryId) where.photo_category_id = photoCategoryId

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

    return new PaginatedResult(
      photos.map((p) => PhotoMapper.toListProjection(p, this.cdn)),
      total,
      pagination,
    )
  }

  /** Retrieves a single photo's detail by ID. */
  async getPhotoDetail(id: string): Promise<PhotoDetailProjection | null> {
    const record = await this.prisma.photo.findUnique({
      where: { id },
      select: PhotoMapper.photoDetailSelectConfig,
    })

    return record
      ? await PhotoMapper.toDetailProjection(record, this.cdn, this.storage, this.correctionRepo)
      : null
  }

  /** Retrieves a single photo's detail by public slug (admin/operator). */
  async getPhotoDetailBySlug(slug: string): Promise<PhotoDetailProjection | null> {
    const record = await this.prisma.photo.findFirst({
      where: { public_slug: slug },
      select: PhotoMapper.photoDetailSelectConfig,
    })

    return record
      ? await PhotoMapper.toDetailProjection(record, this.cdn, this.storage, this.correctionRepo)
      : null
  }

  /** Retrieves a lightweight photo view by public slug. */
  async getPhotoViewBySlug(slug: string): Promise<PhotoViewProjection | null> {
    const record = await this.prisma.photo.findFirst({
      where: { public_slug: slug },
      select: PhotoMapper.photoViewSelectConfig,
    })

    return record ? PhotoMapper.toViewProjection(record, this.cdn) : null
  }

  /** Searches photos across events with multi-criteria filtering. */
  async searchPhotos(
    filters: SearchPhotosFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<PhotoListProjection>> {
    const matchedIds = await this.findPhotoIdsByAttributeFilters(filters)
    if (matchedIds !== null && matchedIds.length === 0) {
      return new PaginatedResult<PhotoListProjection>([], 0, pagination)
    }

    const where = this.buildSearchWhere(filters)
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

    return new PaginatedResult(
      photos.map((p) => PhotoMapper.toListProjection(p, this.cdn)),
      total,
      pagination,
    )
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

  /** Counts all photos globally. */
  async countAll(): Promise<number> {
    return this.prisma.photo.count()
  }

  /** Returns the sum of all photo file sizes in bytes. */
  async sumAllFileSize(): Promise<number> {
    const result = await this.prisma.photo.aggregate({ _sum: { file_size: true } })
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
  ): Promise<Array<{ filename: string; storageKey: string; fileSize: number }>> {
    const photos = await this.prisma.photo.findMany({
      where: { event_id: eventId },
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
  ): Promise<{ photoId: string | null; page: number }> {
    const firstUnclassified = await this.prisma.photo.findFirst({
      where: { event_id: eventId, status: { not: PhotoStatus.reviewed } },
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
    const { eventSlug, status, limit, offset } = params
    const reviewedFilter = reviewedAtFilter(status)

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
