import type { Photo } from '../entities'

export interface IPhotoReadRepository {
  findById(id: string): Promise<Photo | null>
}

export const PHOTO_READ_REPOSITORY = Symbol('PHOTO_READ_REPOSITORY')
