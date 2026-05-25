import type { PhotoColor } from '@classifications/domain/entities'
import type { ColorRegion } from '@generated/prisma/client'

export interface IPhotoColorWriteRepository {
  findById(colorId: string): Promise<{
    id: string
    photoId: string
    region: ColorRegion
    primaryColor: string
    secondaryColor: string | null
  } | null>
  save(color: PhotoColor): Promise<PhotoColor>
  softDelete(colorId: string, reviewerId: string): Promise<void>
}

export const PHOTO_COLOR_WRITE_REPOSITORY = Symbol('PHOTO_COLOR_WRITE_REPOSITORY')
