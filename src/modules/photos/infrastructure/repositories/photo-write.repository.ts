import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import type { Photo } from '@photos/domain/entities'
import type { IPhotoWriteRepository } from '@photos/domain/ports'
import type { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { PrismaService } from '@shared/infrastructure'
import * as PhotoMapper from '../mappers/photo.mapper'

@Injectable()
export class PhotoWriteRepository implements IPhotoWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persists a photo entity (create or update). */
  async save(photo: Photo, tx?: Prisma.TransactionClient): Promise<Photo> {
    const client = tx ?? this.prisma
    const data = PhotoMapper.toPersistence(photo)

    const saved = await client.photo.upsert({
      where: { id: photo.id },
      create: data,
      update: data,
    })

    return PhotoMapper.toEntity(saved)
  }

  /** Batch-inserts photos, silently skipping duplicates by storage_key. Returns the ids actually created. */
  async saveMany(photos: Photo[], tx?: Prisma.TransactionClient): Promise<string[]> {
    const client = tx ?? this.prisma
    const data = photos.map(PhotoMapper.toPersistence)
    const created = await client.photo.createManyAndReturn({
      data,
      skipDuplicates: true,
      select: { id: true },
    })
    return created.map((row) => row.id)
  }

  // Conditional UPDATE so concurrent batches cannot both pass the cap.
  async claimPhotoQuota(
    eventId: string,
    amount: number,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const affected = await tx.$executeRaw`
      UPDATE events
         SET photos_uploaded = photos_uploaded + ${amount}
       WHERE id = ${eventId}::uuid
         AND (photo_quota IS NULL OR photos_uploaded + ${amount} <= photo_quota)
    `
    return affected > 0
  }

  /** Hard-deletes a photo by ID. */
  async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma
    await client.photo.delete({ where: { id } })
  }

  /** Bulk-updates photo_category_id on multiple photos. Returns count of updated records. */
  async bulkUpdateCategory(
    photoIds: string[],
    photoCategoryId: number | null,
    scope: EventScope,
  ): Promise<number> {
    const result = await this.prisma.photo.updateMany({
      where: { id: { in: photoIds }, event: scope.toPrisma() },
      data: { photo_category_id: photoCategoryId },
    })
    return result.count
  }

  /** Flips the requires_retouch flag on a single photo (admin re-mark / dismiss). */
  async setRequiresRetouch(photoId: string, value: boolean): Promise<void> {
    await this.prisma.photo.update({
      where: { id: photoId },
      data: { requires_retouch: value },
    })
  }
}
