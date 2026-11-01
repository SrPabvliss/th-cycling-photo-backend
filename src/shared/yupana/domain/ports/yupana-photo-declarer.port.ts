import type { Prisma } from '@generated/prisma/client'

export interface DeclarablePhoto {
  id: string
  eventId: string
  fileSize: bigint
  retouchedFileSize: bigint | null
  uploadedAt: Date
}

export interface IYupanaPhotoDeclarer {
  declareStored(photos: DeclarablePhoto[], tx: Prisma.TransactionClient): Promise<void>
  declareResized(photo: DeclarablePhoto, tx: Prisma.TransactionClient): Promise<void>
  declareRemoved(photo: DeclarablePhoto, tx: Prisma.TransactionClient): Promise<void>
}

export const YUPANA_PHOTO_DECLARER = Symbol('YUPANA_PHOTO_DECLARER')
