import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { PhotoCategoryProjection } from '../../application/projections'
import type { PhotoCategory } from '../../domain/entities'
import type { IPhotoCategoryReadRepository } from '../../domain/ports'
import * as PhotoCategoryMapper from '../mappers/photo-category.mapper'

@Injectable()
export class PhotoCategoryReadRepository implements IPhotoCategoryReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<PhotoCategory | null> {
    const record = await this.prisma.photoCategory.findFirst({ where: { id } })
    return record ? PhotoCategoryMapper.toEntity(record) : null
  }

  async findClashing(name: string, tenantId: string | null): Promise<PhotoCategory | null> {
    const record = await this.prisma.photoCategory.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        OR: [{ tenant_id: null }, ...(tenantId ? [{ tenant_id: tenantId }] : [])],
      },
    })
    return record ? PhotoCategoryMapper.toEntity(record) : null
  }

  async getAvailable(tenantId: string | null): Promise<PhotoCategoryProjection[]> {
    const records = await this.prisma.photoCategory.findMany({
      where: { OR: [{ tenant_id: null }, ...(tenantId ? [{ tenant_id: tenantId }] : [])] },
      select: PhotoCategoryMapper.photoCategorySelect(
        tenantId ? { event: { tenant_id: tenantId } } : { id: { in: [] } },
      ),
      orderBy: [{ tenant_id: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
    })
    return records.map(PhotoCategoryMapper.toProjection)
  }

  async getByEvent(eventId: string): Promise<PhotoCategoryProjection[]> {
    const records = await this.prisma.eventPhotoCategory.findMany({
      where: { event_id: eventId },
      select: {
        photo_category: { select: PhotoCategoryMapper.photoCategorySelect({ event_id: eventId }) },
      },
      orderBy: { photo_category: { name: 'asc' } },
    })
    return records.map((r) => PhotoCategoryMapper.toProjection(r.photo_category))
  }
}
