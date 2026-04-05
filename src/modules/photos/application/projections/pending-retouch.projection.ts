export class PendingRetouchPhotoProjection {
  /** Photo UUID */
  id: string
  /** Original filename */
  filename: string
  /** CDN thumbnail URL */
  thumbnailUrl: string
  /** Whether the photo has been retouched */
  isRetouched: boolean
}

export class PendingRetouchOrderProjection {
  /** Order UUID */
  orderId: string
  /** When the order was created */
  orderCreatedAt: Date
  /** Event name */
  eventName: string
  /** Customer display name */
  userName: string
  /** Photos in the order */
  photos: PendingRetouchPhotoProjection[]
}
