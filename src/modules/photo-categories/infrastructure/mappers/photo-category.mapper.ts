import type { Prisma, PhotoCategory as PrismaPhotoCategory } from '@generated/prisma/client'
import type { PhotoCategoryProjection } from '../../application/projections'
import { PhotoCategory } from '../../domain/entities'

type PhotoCategorySelect = {
  id: string
  name: string
  _count: { photos: number }
}

export function toPersistence(entity: PhotoCategory): Prisma.PhotoCategoryUncheckedCreateInput {
  return {
    id: entity.id,
    name: entity.name,
    created_at: entity.createdAt,
  }
}

export function toEntity(record: PrismaPhotoCategory): PhotoCategory {
  return PhotoCategory.fromPersistence({
    id: record.id,
    name: record.name,
    createdAt: record.created_at,
  })
}

export function toProjection(record: PhotoCategorySelect): PhotoCategoryProjection {
  return {
    id: record.id,
    name: record.name,
    photoCount: record._count.photos,
  }
}
