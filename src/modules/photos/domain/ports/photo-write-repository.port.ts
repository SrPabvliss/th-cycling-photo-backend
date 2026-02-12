import type { Photo } from '../entities'

export interface IPhotoWriteRepository {
  save(photo: Photo): Promise<Photo>
  delete(id: string): Promise<void>
}

export const PHOTO_WRITE_REPOSITORY = Symbol('PHOTO_WRITE_REPOSITORY')
