import type {
  AttributeSource,
  BibReadingStatus,
  ColorRegion,
  ProcessingStageName,
  ProcessingStageStatus,
} from '@generated/prisma/client'

export interface PersistStageInput {
  stage: ProcessingStageName
  status: ProcessingStageStatus
  ms: number
  itemsProcessed: number
  itemsSucceeded: number
  itemsFailed: number
  notes: string[]
}

export interface PersistDetectionInput {
  className: string
  classId: number
  confidence: number
  bbox: [number, number, number, number]
}

export interface PersistBibInput {
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
}

export interface PersistColorInput {
  source: AttributeSource
  region: ColorRegion
  primaryColor: string
  secondaryColor: string | null
  confidence: number | null
  bboxSource: [number, number, number, number] | null
  strategy: string | null
  processingMs: number | null
}

export interface PersistResultInput {
  photoId: string
  processing: {
    schemaVersion: string
    totalMs: number
    modelVersions: Record<string, string>
    startedAt: Date
    completedAt: Date
  }
  stages: PersistStageInput[]
  detections: PersistDetectionInput[]
  bibs: PersistBibInput[]
  colors: PersistColorInput[]
}

export interface PersistFailureInput {
  photoId: string
  schemaVersion: string | null
  errorMessage: string
  startedAt: Date
}

export interface IPhotoClassificationWriteRepository {
  persistResult(input: PersistResultInput): Promise<{ processingId: string }>
  persistFailure(input: PersistFailureInput): Promise<{ processingId: string }>
}

export const PHOTO_CLASSIFICATION_WRITE_REPOSITORY = Symbol('PHOTO_CLASSIFICATION_WRITE_REPOSITORY')
