import type { PhotoColor } from '@classifications/domain/entities'

export interface IPhotoColorWriteRepository {
  findById(colorId: string): Promise<{
    id: string
    photoId: string
    primaryColor: string
    secondaryColor: string | null
  } | null>
  save(color: PhotoColor): Promise<PhotoColor>
}

export const PHOTO_COLOR_WRITE_REPOSITORY = Symbol('PHOTO_COLOR_WRITE_REPOSITORY')
