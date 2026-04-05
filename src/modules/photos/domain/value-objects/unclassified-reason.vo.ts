export const UnclassifiedReason = {
  NO_PARTICIPANT: 'no_participant',
  OCR_FAILED: 'ocr_failed',
  LOW_CONFIDENCE: 'low_confidence',
  PROCESSING_ERROR: 'processing_error',
} as const

export type UnclassifiedReasonType = (typeof UnclassifiedReason)[keyof typeof UnclassifiedReason]
