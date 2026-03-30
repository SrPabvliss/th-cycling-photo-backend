import { Injectable } from '@nestjs/common'
import type { Photo } from '@photos/domain/entities'
import type { IPhotoWriteRepository } from '@photos/domain/ports'
import { PrismaService } from '@shared/infrastructure'
import * as PhotoMapper from '../mappers/photo.mapper'

@Injectable()
export class PhotoWriteRepository implements IPhotoWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persists a photo entity (create or update). */
  async save(photo: Photo): Promise<Photo> {
    const data = PhotoMapper.toPersistence(photo)

    const saved = await this.prisma.photo.upsert({
      where: { id: photo.id },
      create: data,
      update: data,
    })

    return PhotoMapper.toEntity(saved)
  }

  /** Batch-inserts photos, silently skipping duplicates by storage_key. Returns count of created records. */
  async saveMany(photos: Photo[]): Promise<number> {
    const data = photos.map(PhotoMapper.toPersistence)
    const result = await this.prisma.photo.createMany({
      data,
      skipDuplicates: true,
    })
    return result.count
  }

  /** Hard-deletes a photo by ID. */
  async delete(id: string): Promise<void> {
    await this.prisma.photo.delete({ where: { id } })
  }

  /** Marks a photo as classified and optionally sets classified_by on its cyclists. */
  async markAsClassified(photoId: string, classifiedById?: string | null): Promise<void> {
    await this.prisma.photo.update({
      where: { id: photoId },
      data: { classified_at: new Date() },
    })

    if (classifiedById) {
      await this.prisma.detectedCyclist.updateMany({
        where: { photo_id: photoId },
        data: { classified_by_id: classifiedById },
      })
    }
  }

  /** Bulk-updates photo_category_id on multiple photos. Returns count of updated records. */
  async bulkUpdateCategory(photoIds: string[], photoCategoryId: string | null): Promise<number> {
    const result = await this.prisma.photo.updateMany({
      where: { id: { in: photoIds } },
      data: { photo_category_id: photoCategoryId },
    })
    return result.count
  }
}
