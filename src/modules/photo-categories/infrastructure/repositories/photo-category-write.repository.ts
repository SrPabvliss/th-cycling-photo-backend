import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { PhotoCategory } from '../../domain/entities'
import type { IPhotoCategoryWriteRepository } from '../../domain/ports'
import * as PhotoCategoryMapper from '../mappers/photo-category.mapper'

@Injectable()
export class PhotoCategoryWriteRepository implements IPhotoCategoryWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(category: PhotoCategory): Promise<PhotoCategory> {
    const data = PhotoCategoryMapper.toPersistence(category)

    if (category.id) {
      const saved = await this.prisma.photoCategory.update({
        where: { id: category.id },
        data: { name: data.name },
      })
      return PhotoCategoryMapper.toEntity(saved)
    }

    const saved = await this.prisma.photoCategory.create({ data })
    return PhotoCategoryMapper.toEntity(saved)
  }

  async assignToEvent(eventId: string, photoCategoryId: number): Promise<string> {
    const record = await this.prisma.eventPhotoCategory.upsert({
      where: {
        event_id_photo_category_id: { event_id: eventId, photo_category_id: photoCategoryId },
      },
      create: { event_id: eventId, photo_category_id: photoCategoryId },
      update: {},
    })
    return record.id
  }

  async unassignFromEvent(eventId: string, photoCategoryId: number): Promise<void> {
    await this.prisma.eventPhotoCategory.deleteMany({
      where: { event_id: eventId, photo_category_id: photoCategoryId },
    })
  }
}
