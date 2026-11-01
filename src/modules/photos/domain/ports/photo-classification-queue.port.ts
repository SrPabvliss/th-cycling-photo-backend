export interface IPhotoClassificationQueue {
  enqueue(photoIds: string[]): Promise<void>
  getLivePhotoIds(): Promise<Set<string>>
}

export const PHOTO_CLASSIFICATION_QUEUE = Symbol('PHOTO_CLASSIFICATION_QUEUE')
