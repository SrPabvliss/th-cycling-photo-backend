import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import type { PhotoDetailProjection, PhotoListProjection } from '@photos/application/projections'
import type { SearchPhotosFilters } from '@photos/application/queries'
import type { Photo } from '@photos/domain/entities'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { PHOTO_DETAIL_SELECT, PHOTO_LIST_SELECT } from '@photos/infrastructure/constants'
import { PaginatedResult, type Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import * as PhotoMapper from '../mappers/photo.mapper'

@Injectable()
export class PhotoReadRepository implements IPhotoReadRepository {
  constructor(private readonly prisma: PrismaService) {}

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
  ): Promise<PaginatedResult<PhotoListProjection>> {
    const where = { event_id: eventId }

    const [photos, total] = await Promise.all([
      this.prisma.photo.findMany({
        where,
        select: PHOTO_LIST_SELECT,
        orderBy: { uploaded_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.photo.count({ where }),
    ])

    return new PaginatedResult(photos.map(PhotoMapper.toListProjection), total, pagination)
  }

  /** Retrieves a single photo's detail with all classification relations. */
  async getPhotoDetail(id: string): Promise<PhotoDetailProjection | null> {
    const record = await this.prisma.photo.findUnique({
      where: { id },
      select: PHOTO_DETAIL_SELECT,
    })

    return record ? PhotoMapper.toDetailProjection(record) : null
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
        select: PHOTO_LIST_SELECT,
        orderBy: { uploaded_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.photo.count({ where }),
    ])

    return new PaginatedResult(photos.map(PhotoMapper.toListProjection), total, pagination)
  }

  /** Returns the storage key of the first uploaded photo for an event. */
  async findFirstStorageKeyByEvent(eventId: string): Promise<string | null> {
    const photo = await this.prisma.photo.findFirst({
      where: { event_id: eventId },
      orderBy: { uploaded_at: 'asc' },
      select: { storage_key: true },
    })
    return photo?.storage_key ?? null
  }

  /** Batch: returns a map of eventId → first photo storage key. */
  async findFirstStorageKeysByEventIds(eventIds: string[]): Promise<Map<string, string>> {
    if (eventIds.length === 0) return new Map()

    const photos = await this.prisma.photo.findMany({
      where: { event_id: { in: eventIds } },
      distinct: ['event_id'],
      orderBy: { uploaded_at: 'asc' },
      select: { event_id: true, storage_key: true },
    })

    return new Map(photos.map((p) => [p.event_id, p.storage_key]))
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

  /** Builds a Prisma where clause from search filters. */
  private buildSearchWhere(filters: SearchPhotosFilters): Prisma.PhotoWhereInput {
    const where: Prisma.PhotoWhereInput = {}

    if (filters.eventId) where.event_id = filters.eventId
    if (filters.status) where.status = filters.status as Prisma.EnumPhotoStatusFilter

    if (filters.plateNumber !== undefined) {
      where.detected_cyclists = {
        some: { plate_number: { number: filters.plateNumber } },
      }
    }

    if (filters.fromDate || filters.toDate) {
      where.uploaded_at = {}
      if (filters.fromDate) where.uploaded_at.gte = filters.fromDate
      if (filters.toDate) where.uploaded_at.lte = filters.toDate
    }

    return where
  }
}
