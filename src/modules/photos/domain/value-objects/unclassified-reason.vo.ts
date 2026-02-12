export const UnclassifiedReason = {
  NO_CYCLIST: 'no_cyclist',
  OCR_FAILED: 'ocr_failed',
  LOW_CONFIDENCE: 'low_confidence',
  PROCESSING_ERROR: 'processing_error',
} as const

export type UnclassifiedReasonType = (typeof UnclassifiedReason)[keyof typeof UnclassifiedReason]
