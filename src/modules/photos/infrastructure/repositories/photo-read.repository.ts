import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import type { PhotoDetailProjection, PhotoListProjection } from '@photos/application/projections'
import type { SearchPhotosFilters } from '@photos/application/queries'
import type { Photo } from '@photos/domain/entities'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { PHOTO_DETAIL_SELECT, PHOTO_LIST_SELECT } from '@photos/infrastructure/constants'
import type { Pagination } from '@shared/application'
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

  /** Retrieves a paginated list of photos for a given event. */
  async getPhotosList(eventId: string, pagination: Pagination): Promise<PhotoListProjection[]> {
    const photos = await this.prisma.photo.findMany({
      where: { event_id: eventId },
      select: PHOTO_LIST_SELECT,
      orderBy: { uploaded_at: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    })

    return photos.map(PhotoMapper.toListProjection)
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
  ): Promise<PhotoListProjection[]> {
    const where = this.buildSearchWhere(filters)

    const photos = await this.prisma.photo.findMany({
      where,
      select: PHOTO_LIST_SELECT,
      orderBy: { uploaded_at: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    })

    return photos.map(PhotoMapper.toListProjection)
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
