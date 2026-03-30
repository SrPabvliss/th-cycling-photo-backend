import type { Photo } from '../entities'

export interface IPhotoWriteRepository {
  save(photo: Photo): Promise<Photo>
  saveMany(photos: Photo[]): Promise<number>
  delete(id: string): Promise<void>
  markAsClassified(photoId: string, classifiedById?: string | null): Promise<void>
  bulkUpdateCategory(photoIds: string[], photoCategoryId: string | null): Promise<number>
}

export const PHOTO_WRITE_REPOSITORY = Symbol('PHOTO_WRITE_REPOSITORY')
