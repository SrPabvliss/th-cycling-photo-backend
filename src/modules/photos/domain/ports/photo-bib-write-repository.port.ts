import type { PhotoBib } from '@classifications/domain/entities'

export interface IPhotoBibWriteRepository {
  findById(bibId: string): Promise<{ id: string; photoId: string; digits: string } | null>
  save(bib: PhotoBib): Promise<PhotoBib>
}

export const PHOTO_BIB_WRITE_REPOSITORY = Symbol('PHOTO_BIB_WRITE_REPOSITORY')
