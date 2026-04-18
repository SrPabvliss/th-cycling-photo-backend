export const PhotoStatus = {
  PENDING: 'pending',
  DETECTING: 'detecting',
  ANALYZING: 'analyzing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type PhotoStatusType = (typeof PhotoStatus)[keyof typeof PhotoStatus]
