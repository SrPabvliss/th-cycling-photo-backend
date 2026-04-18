import { Prisma, type PhotoCategory as PrismaPhotoCategory } from '@generated/prisma/client'
import type { PhotoCategoryProjection } from '../../application/projections'
import { PhotoCategory } from '../../domain/entities'

export const photoCategorySelectConfig = {
  id: true,
  name: true,
  _count: { select: { photos: true } },
} satisfies Prisma.PhotoCategorySelect

export type PhotoCategorySelect = Prisma.PhotoCategoryGetPayload<{
  select: typeof photoCategorySelectConfig
}>

export function toPersistence(
  entity: PhotoCategory,
): Omit<Prisma.PhotoCategoryUncheckedCreateInput, 'id'> {
  return {
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
