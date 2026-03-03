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
}
