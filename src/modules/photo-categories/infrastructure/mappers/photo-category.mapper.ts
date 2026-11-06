import type { Prisma, PhotoCategory as PrismaPhotoCategory } from '@generated/prisma/client'
import type { PhotoCategoryProjection } from '../../application/projections'
import { PhotoCategory } from '../../domain/entities'

/** Select for a category projection, counting only the photos of `photoWhere`. */
export const photoCategorySelect = (photoWhere: Prisma.PhotoWhereInput) =>
  ({
    id: true,
    name: true,
    tenant_id: true,
    _count: { select: { photos: { where: photoWhere } } },
  }) satisfies Prisma.PhotoCategorySelect

export type PhotoCategorySelect = {
  id: number
  name: string
  tenant_id: string | null
  _count: { photos: number }
}

export function toPersistence(
  entity: PhotoCategory,
): Omit<Prisma.PhotoCategoryUncheckedCreateInput, 'id'> {
  return {
    name: entity.name,
    tenant_id: entity.tenantId,
    created_at: entity.createdAt,
  }
}

export function toEntity(record: PrismaPhotoCategory): PhotoCategory {
  return PhotoCategory.fromPersistence({
    id: record.id,
    name: record.name,
    tenantId: record.tenant_id,
    createdAt: record.created_at,
  })
}

export function toProjection(record: PhotoCategorySelect): PhotoCategoryProjection {
  return {
    id: record.id,
    name: record.name,
    scope: record.tenant_id === null ? 'base' : 'own',
    photoCount: record._count.photos,
  }
}
