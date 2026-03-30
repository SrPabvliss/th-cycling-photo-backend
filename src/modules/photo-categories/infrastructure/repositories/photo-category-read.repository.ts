import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { PhotoCategoryProjection } from '../../application/projections'
import type { PhotoCategory } from '../../domain/entities'
import type { IPhotoCategoryReadRepository } from '../../domain/ports'
import * as PhotoCategoryMapper from '../mappers/photo-category.mapper'

@Injectable()
export class PhotoCategoryReadRepository implements IPhotoCategoryReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PhotoCategory | null> {
    const record = await this.prisma.photoCategory.findFirst({ where: { id } })
    return record ? PhotoCategoryMapper.toEntity(record) : null
  }

  async findByName(name: string): Promise<PhotoCategory | null> {
    const record = await this.prisma.photoCategory.findFirst({ where: { name } })
    return record ? PhotoCategoryMapper.toEntity(record) : null
  }

  async getAll(): Promise<PhotoCategoryProjection[]> {
    const records = await this.prisma.photoCategory.findMany({
      select: { id: true, name: true, _count: { select: { photos: true } } },
      orderBy: { name: 'asc' },
    })
    return records.map(PhotoCategoryMapper.toProjection)
  }

  async getByEvent(eventId: string): Promise<PhotoCategoryProjection[]> {
    const records = await this.prisma.eventPhotoCategory.findMany({
      where: { event_id: eventId },
      select: {
        photo_category: {
          select: { id: true, name: true, _count: { select: { photos: true } } },
        },
      },
      orderBy: { photo_category: { name: 'asc' } },
    })
    return records.map((r) => PhotoCategoryMapper.toProjection(r.photo_category))
  }
}
