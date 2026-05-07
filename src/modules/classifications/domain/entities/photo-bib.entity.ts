import { AttributeSource, BibReadingStatus } from '@generated/prisma/client'

export class PhotoBib {
  private constructor(
    public readonly id: string,
    public readonly photoId: string,
    public readonly photoProcessingId: string | null,
    public readonly source: AttributeSource,
    public readonly digits: string,
    public readonly confidence: number | null,
    public readonly confidencePerDigit: number[] | null,
    public readonly status: BibReadingStatus | null,
    public readonly rejectionReason: string | null,
    public readonly rawOcrText: string | null,
    public readonly bboxSource: [number, number, number, number] | null,
    public readonly preprocessingApplied: string[] | null,
    public readonly processingMs: number | null,
    public readonly createdById: string | null,
  ) {}

  static createFromAi(data: {
    photoId: string
    photoProcessingId: string
    digits: string
    confidence: number
    confidencePerDigit: number[]
    status: BibReadingStatus
    rejectionReason: string | null
    rawOcrText: string | null
    bboxSource: [number, number, number, number]
    preprocessingApplied: string[]
    processingMs: number
  }): PhotoBib {
    return new PhotoBib(
      crypto.randomUUID(),
      data.photoId,
      data.photoProcessingId,
      AttributeSource.ai,
      data.digits,
      data.confidence,
      data.confidencePerDigit,
      data.status,
      data.rejectionReason,
      data.rawOcrText,
      data.bboxSource,
      data.preprocessingApplied,
      data.processingMs,
      null,
    )
  }

  static fromPersistence(data: {
    id: string
    photoId: string
    photoProcessingId: string | null
    source: AttributeSource
    digits: string
    confidence: number | null
    confidencePerDigit: number[] | null
    status: BibReadingStatus | null
    rejectionReason: string | null
    rawOcrText: string | null
    bboxSource: [number, number, number, number] | null
    preprocessingApplied: string[] | null
    processingMs: number | null
    createdById: string | null
  }): PhotoBib {
    return new PhotoBib(
      data.id,
      data.photoId,
      data.photoProcessingId,
      data.source,
      data.digits,
      data.confidence,
      data.confidencePerDigit,
      data.status,
      data.rejectionReason,
      data.rawOcrText,
      data.bboxSource,
      data.preprocessingApplied,
      data.processingMs,
      data.createdById,
    )
  }
}
