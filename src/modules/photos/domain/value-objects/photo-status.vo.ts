import { PhotoStatus as PrismaPhotoStatus } from '@generated/prisma/client'

export const PhotoStatus = {
  PENDING: PrismaPhotoStatus.pending,
  PROCESSING: PrismaPhotoStatus.processing,
  PROCESSED: PrismaPhotoStatus.processed,
  FAILED: PrismaPhotoStatus.failed,
  REVIEWED: PrismaPhotoStatus.reviewed,
} as const

export type PhotoStatusType = (typeof PhotoStatus)[keyof typeof PhotoStatus]
