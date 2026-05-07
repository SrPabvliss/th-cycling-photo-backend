import {
  BibReadingStatus,
  ColorRegion,
  ProcessingStageName,
  ProcessingStageStatus,
} from '@generated/prisma/client'

/** Input for the classification pipeline adapter. */
export interface ClassificationPipelineRequest {
  imageId: string
  imageUrl: string
  eventId?: string
  confidenceThreshold?: number
}

export interface DetectionDto {
  className: string
  classId: number
  confidence: number
  bbox: [number, number, number, number]
}

export interface BibReadingDto {
  digits: string
  confidence: number
  confidencePerDigit: number[]
  status: BibReadingStatus
  rejectionReason: string | null
  preprocessingApplied: string[]
  bboxSource: [number, number, number, number]
  rawOcrText: string | null
  processingMs: number
}

export interface ColorAnalysisDto {
  region: ColorRegion
  primaryColor: string
  secondaryColor: string | null
  confidence: number
  bboxSource: [number, number, number, number]
  strategy: string
  processingMs: number
}

export interface StageTimingsDto {
  totalMs: number
  detectionMs: number
  ocrMs: number
  colorMs: number
}

export interface StageResultDto {
  stage: ProcessingStageName
  status: ProcessingStageStatus
  itemsProcessed: number
  itemsSucceeded: number
  itemsFailed: number
  notes: string[]
}

export interface ClassificationPipelineResponse {
  schemaVersion: string
  imageId: string
  detections: DetectionDto[]
  bibReadings: BibReadingDto[]
  colorAnalyses: ColorAnalysisDto[]
  imageWidth: number
  imageHeight: number
  processingMs: number
  timings: StageTimingsDto
  stageResults: StageResultDto[]
  modelVersions: { detection: string; ocr: string; color: string }
}

export interface HealthCheckResponse {
  status: string
  modelsLoaded: string[]
  ramUsageMb: number
}

export interface IClassificationPipelineAdapter {
  classify(request: ClassificationPipelineRequest): Promise<ClassificationPipelineResponse>
  healthCheck(): Promise<HealthCheckResponse>
}

export const CLASSIFICATION_PIPELINE_ADAPTER = Symbol('CLASSIFICATION_PIPELINE_ADAPTER')
