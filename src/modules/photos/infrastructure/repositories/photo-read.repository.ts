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
} from '@photos/domain/ports'

import { PaginatedResult, type Pagination } from '@shared/application'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { PrismaService } from '@shared/infrastructure'
import {
  type IStorageAdapter,
  STORAGE_ADAPTER,
} from '@shared/storage/domain/ports/storage-adapter.port'
import * as PhotoMapper from '../mappers/photo.mapper'

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
    const where = this.buildSearchWhere(filters)

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
        EXISTS(SELECT 1 FROM photo_bibs pb WHERE pb.photo_id = p.id) as has_classifications
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
    onlyPending: boolean
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
    const { eventSlug, onlyPending, limit, offset } = params

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
             (SELECT MIN(confidence) FROM photo_bibs WHERE photo_id = p.id) AS min_bib_confidence,
             (SELECT COUNT(*)::bigint FROM photo_bibs WHERE photo_id = p.id) AS bibs_count,
             (SELECT COUNT(*)::bigint FROM photo_colors WHERE photo_id = p.id) AS colors_count
      FROM photos p
      INNER JOIN events e ON e.id = p.event_id
      WHERE e.slug = ${eventSlug}
        AND p.status IN ('processed'::photo_status, 'reviewed'::photo_status, 'failed'::photo_status)
        AND (NOT ${onlyPending}::bool OR p.reviewed_at IS NULL)
      ORDER BY (SELECT MIN(confidence) FROM photo_bibs WHERE photo_id = p.id) ASC NULLS FIRST,
               p.uploaded_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `

    const totalRow = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM photos p
      INNER JOIN events e ON e.id = p.event_id
      WHERE e.slug = ${eventSlug}
        AND p.status IN ('processed'::photo_status, 'reviewed'::photo_status, 'failed'::photo_status)
        AND (NOT ${onlyPending}::bool OR p.reviewed_at IS NULL)
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

  /** Builds a Prisma where clause from search filters. */
  private buildSearchWhere(filters: SearchPhotosFilters): Prisma.PhotoWhereInput {
    const where: Prisma.PhotoWhereInput = {}

    if (filters.eventId) where.event_id = filters.eventId
    if (filters.status) where.status = filters.status as Prisma.EnumPhotoStatusFilter

    const conditions: Prisma.PhotoWhereInput[] = []

    if (filters.plateNumber !== undefined) {
      conditions.push({
        bibs: {
          some: { digits: String(filters.plateNumber) },
        },
      })
    }

    const helmetColors = filters.helmetColor
      ? filters.helmetColor.split(',').map((c) => c.trim())
      : []
    if (helmetColors.length > 0) {
      conditions.push({
        colors: {
          some: { region: 'helmet', primary_color: { in: helmetColors, mode: 'insensitive' } },
        },
      })
    }

    const clothingColors = filters.clothingColor
      ? filters.clothingColor.split(',').map((c) => c.trim())
      : []
    if (clothingColors.length > 0) {
      conditions.push({
        colors: {
          some: {
            region: 'cyclist_clothes',
            primary_color: { in: clothingColors, mode: 'insensitive' },
          },
        },
      })
    }

    const bicycleColors = filters.bikeColor ? filters.bikeColor.split(',').map((c) => c.trim()) : []
    if (bicycleColors.length > 0) {
      conditions.push({
        colors: {
          some: { region: 'bicycle', primary_color: { in: bicycleColors, mode: 'insensitive' } },
        },
      })
    }

    if (conditions.length > 0) {
      where.AND = where.AND
        ? [...(where.AND as Prisma.PhotoWhereInput[]), ...conditions]
        : conditions
    }

    if (filters.fromDate || filters.toDate) {
      where.uploaded_at = {}
      if (filters.fromDate) where.uploaded_at.gte = filters.fromDate
      if (filters.toDate) where.uploaded_at.lte = filters.toDate
    }

    return where
  }
}
