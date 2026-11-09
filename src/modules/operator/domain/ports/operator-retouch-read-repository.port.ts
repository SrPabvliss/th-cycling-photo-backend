import type { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { OperatorRetouchEventProjection } from '../../application/projections'

export type RetouchOrderScope = 'pending' | 'completed'

export type OperatorRetouchPhotoRow = {
  photoId: string
  publicSlug: string
  filename: string
  retouchedStorageKey: string | null
}

export type OperatorRetouchOrderRow = {
  orderId: string
  buyerName: string
  eventId: string
  eventName: string
  createdAt: Date
  pendingPhotosCount: number
  totalPhotosCount: number
  retouchedPhotosCount: number
  previewPhotos: OperatorRetouchPhotoRow[]
}

export type OperatorRetouchOrderDetailRow = {
  orderId: string
  buyerName: string
  eventId: string
  eventName: string
  createdAt: Date
  photos: OperatorRetouchPhotoRow[]
}

export type OperatorRetouchQueueOrderRow = {
  orderId: string
  buyerName: string
  eventId: string
  eventName: string
  createdAt: Date
  items: OperatorRetouchPhotoRow[]
}

export interface IOperatorRetouchReadRepository {
  findRetouchableEvents(scope: EventScope): Promise<OperatorRetouchEventProjection[]>
  getRetouchQueuePage(
    eventId: string,
    scope: RetouchOrderScope,
    skip: number,
    take: number,
  ): Promise<{ items: OperatorRetouchQueueOrderRow[]; total: number }>
  findOperatorRetouchOrdersPage(
    eventIds: string[] | null,
    scope: RetouchOrderScope,
    skip: number,
    take: number,
  ): Promise<{ items: OperatorRetouchOrderRow[]; total: number }>
  findOrderDetailRow(
    orderId: string,
    onlyPending: boolean,
  ): Promise<OperatorRetouchOrderDetailRow | null>
  findPhotoEventId(photoId: string): Promise<string | null>
  isOperatorAssigned(eventId: string, operatorId: string): Promise<boolean>
}

export const OPERATOR_RETOUCH_READ_REPOSITORY = Symbol('OPERATOR_RETOUCH_READ_REPOSITORY')
