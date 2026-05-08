import { AttributeSource, ProcessingStageName } from '@generated/prisma/client'
import type {
  ClassificationPipelineResponse,
  StageTimingsDto,
} from '@shared/ai-pipeline/domain/ports'
import type {
  PersistBibInput,
  PersistColorInput,
  PersistDetectionInput,
  PersistResultInput,
  PersistStageInput,
} from '../../domain/ports'

export class PipelineResponseMapper {
  static toPersistInput(
    photoId: string,
    response: ClassificationPipelineResponse,
    startedAt: Date,
    completedAt: Date,
  ): PersistResultInput {
    return {
      photoId,
      processing: {
        schemaVersion: response.schemaVersion,
        totalMs: response.timings.totalMs,
        modelVersions: response.modelVersions,
        startedAt,
        completedAt,
      },
      stages: response.stageResults.map(
        (s): PersistStageInput => ({
          stage: s.stage,
          status: s.status,
          ms: PipelineResponseMapper.stageMs(s.stage, response.timings),
          itemsProcessed: s.itemsProcessed,
          itemsSucceeded: s.itemsSucceeded,
          itemsFailed: s.itemsFailed,
          notes: s.notes,
        }),
      ),
      detections: response.detections.map(
        (d): PersistDetectionInput => ({
          className: d.className,
          classId: d.classId,
          confidence: d.confidence,
          bbox: d.bbox,
        }),
      ),
      bibs: response.bibReadings.map(
        (b): PersistBibInput => ({
          source: AttributeSource.ai,
          digits: b.digits,
          confidence: b.confidence,
          confidencePerDigit: b.confidencePerDigit,
          status: b.status,
          rejectionReason: b.rejectionReason,
          rawOcrText: b.rawOcrText,
          bboxSource: b.bboxSource,
          preprocessingApplied: b.preprocessingApplied,
          processingMs: b.processingMs,
          cropPath: b.cropPath,
        }),
      ),
      colors: response.colorAnalyses.map(
        (c): PersistColorInput => ({
          source: AttributeSource.ai,
          region: c.region,
          primaryColor: c.primaryColor,
          secondaryColor: c.secondaryColor,
          confidence: c.confidence,
          bboxSource: c.bboxSource,
          strategy: c.strategy,
          processingMs: c.processingMs,
          cropPath: c.cropPath,
        }),
      ),
    }
  }

  private static stageMs(stage: ProcessingStageName, t: StageTimingsDto): number {
    switch (stage) {
      case ProcessingStageName.detection:
        return t.detectionMs
      case ProcessingStageName.ocr:
        return t.ocrMs
      case ProcessingStageName.color:
        return t.colorMs
    }
  }
}
