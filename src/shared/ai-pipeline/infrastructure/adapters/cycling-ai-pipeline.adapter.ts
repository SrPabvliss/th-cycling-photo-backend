import { ProcessingStageStatus } from '@generated/prisma/client'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppException, ErrorCode } from '@shared/domain'
import type {
  BibReadingDto,
  ClassificationPipelineRequest,
  ClassificationPipelineResponse,
  ColorAnalysisDto,
  DetectionDto,
  HealthCheckResponse,
  IClassificationPipelineAdapter,
  StageResultDto,
} from '../../domain/ports'
import { HealthResponseV1Schema, PipelineResponseV1Schema } from './schemas-runtime'

const SUPPORTED_SCHEMA_VERSIONS = new Set(['1.0', '1.1', '1.2'])

@Injectable()
export class CyclingAiPipelineAdapter implements IClassificationPipelineAdapter {
  private readonly logger = new Logger(CyclingAiPipelineAdapter.name)
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('aiPipeline.baseUrl')
    this.timeoutMs = config.get<number>('aiPipeline.timeoutMs', 15_000)
  }

  async classify(request: ClassificationPipelineRequest): Promise<ClassificationPipelineResponse> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/pipeline?detector=yolo&ocr=parseq&color=gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id: request.imageId,
          image_url: request.imageUrl,
          event_id: request.eventId ?? null,
          confidence_threshold: request.confidenceThreshold ?? 0.25,
          ...(request.cropUploadUrls
            ? {
                crop_upload_urls: {
                  bibs: request.cropUploadUrls.bibs,
                  colors_helmet: request.cropUploadUrls.colorsHelmet,
                  colors_clothes: request.cropUploadUrls.colorsClothes,
                  colors_bicycle: request.cropUploadUrls.colorsBicycle,
                },
              }
            : {}),
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (error) {
      this.logger.error(
        `AI pipeline network failure: ${error instanceof Error ? error.message : String(error)}`,
      )
      throw new AppException(
        'ai_pipeline.service_unavailable',
        HttpStatus.BAD_GATEWAY,
        ErrorCode.EXTERNAL_SERVICE,
        false,
        { cause: error instanceof Error ? error.message : String(error) },
      )
    }

    if (response.status >= 500) {
      const body = await response.text().catch(() => 'no body')
      this.logger.error(`AI pipeline 5xx ${response.status}: ${body}`)
      throw new AppException(
        'ai_pipeline.service_unavailable',
        HttpStatus.BAD_GATEWAY,
        ErrorCode.EXTERNAL_SERVICE,
        false,
        { httpStatus: response.status, body },
      )
    }

    if (response.status >= 400) {
      const body = await response.text().catch(() => 'no body')
      this.logger.error(`AI pipeline 4xx ${response.status}: ${body}`)
      throw new AppException(
        'ai_pipeline.invalid_request',
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.BUSINESS_RULE,
        false,
        { httpStatus: response.status, body },
      )
    }

    const json = await response.json().catch(() => null)

    const parsed = PipelineResponseV1Schema.safeParse(json)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      this.logger.error(
        `Invalid response shape: ${firstIssue?.path.join('.')}: ${firstIssue?.message}`,
      )
      throw new AppException(
        'ai_pipeline.invalid_response_shape',
        HttpStatus.BAD_GATEWAY,
        ErrorCode.EXTERNAL_SERVICE,
        false,
        { issue: firstIssue },
      )
    }
    const raw = parsed.data

    if (!SUPPORTED_SCHEMA_VERSIONS.has(raw.schema_version)) {
      throw new AppException(
        'ai_pipeline.unsupported_schema_version',
        HttpStatus.BAD_GATEWAY,
        ErrorCode.EXTERNAL_SERVICE,
        false,
        { received: raw.schema_version, expected: '1.0 | 1.1 | 1.2' },
      )
    }

    if (raw.image_id !== request.imageId) {
      throw new AppException(
        'ai_pipeline.image_id_mismatch',
        HttpStatus.BAD_GATEWAY,
        ErrorCode.EXTERNAL_SERVICE,
        false,
        { sent: request.imageId, received: raw.image_id },
      )
    }

    const partialOrFailedStages = raw.stage_results.filter(
      (s) =>
        s.status === ProcessingStageStatus.partial || s.status === ProcessingStageStatus.failed,
    )
    if (partialOrFailedStages.length > 0) {
      this.logger.warn(
        `Pipeline reported partial/failed stages for ${request.imageId}: ` +
          partialOrFailedStages.map((s) => `${s.stage}=${s.status}`).join(', '),
      )
    }

    return {
      schemaVersion: raw.schema_version,
      imageId: raw.image_id,
      detections: raw.detections.map(
        (d): DetectionDto => ({
          className: d.class_name,
          classId: d.class_id,
          confidence: d.confidence,
          bbox: d.bbox,
        }),
      ),
      bibReadings: raw.bib_readings.map(
        (b): BibReadingDto => ({
          digits: b.digits,
          confidence: b.confidence,
          confidencePerDigit: b.confidence_per_digit,
          status: b.status,
          rejectionReason: b.rejection_reason,
          preprocessingApplied: b.preprocessing_applied,
          bboxSource: b.bbox_source,
          rawOcrText: b.raw_ocr_text,
          processingMs: b.processing_ms,
          cropPath: b.crop_path ?? null,
        }),
      ),
      colorAnalyses: raw.color_analyses.map(
        (c): ColorAnalysisDto => ({
          region: c.region,
          primaryColor: c.primary_color,
          secondaryColor: c.secondary_color,
          confidence: c.confidence,
          bboxSource: c.bbox_source,
          strategy: c.strategy,
          processingMs: c.processing_ms,
          cropPath: c.crop_path ?? null,
        }),
      ),
      imageWidth: raw.image_width,
      imageHeight: raw.image_height,
      processingMs: raw.processing_ms,
      timings: {
        totalMs: raw.timings.total_ms,
        detectionMs: raw.timings.detection_ms,
        ocrMs: raw.timings.ocr_ms,
        colorMs: raw.timings.color_ms,
      },
      stageResults: raw.stage_results.map(
        (s): StageResultDto => ({
          stage: s.stage,
          status: s.status,
          itemsProcessed: s.items_processed,
          itemsSucceeded: s.items_succeeded,
          itemsFailed: s.items_failed,
          notes: s.notes,
        }),
      ),
      modelVersions: raw.model_versions,
    }
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(5_000) })
    } catch (error) {
      throw AppException.externalService(
        'CyclingAiPipeline',
        error instanceof Error ? error : undefined,
      )
    }

    if (!response.ok) {
      throw AppException.externalService('CyclingAiPipeline')
    }

    const parsed = HealthResponseV1Schema.safeParse(await response.json().catch(() => null))
    if (!parsed.success) {
      throw AppException.externalService('CyclingAiPipeline')
    }

    return {
      status: parsed.data.status,
      modelsLoaded: parsed.data.models_loaded,
      ramUsageMb: parsed.data.ram_usage_mb,
    }
  }
}
