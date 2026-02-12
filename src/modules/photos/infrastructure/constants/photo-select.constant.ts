import { CLASSIFICATION_DETAIL_SELECT } from '@classifications/infrastructure/constants'

/** Prisma select shape for photo list items (lightweight). */
export const PHOTO_LIST_SELECT = {
  id: true,
  event_id: true,
  filename: true,
  storage_key: true,
  status: true,
  width: true,
  height: true,
  uploaded_at: true,
} as const

/** Prisma select shape for photo detail with classification relations. */
export const PHOTO_DETAIL_SELECT = {
  id: true,
  event_id: true,
  filename: true,
  storage_key: true,
  file_size: true,
  mime_type: true,
  width: true,
  height: true,
  status: true,
  unclassified_reason: true,
  captured_at: true,
  uploaded_at: true,
  processed_at: true,
  ...CLASSIFICATION_DETAIL_SELECT,
} as const
