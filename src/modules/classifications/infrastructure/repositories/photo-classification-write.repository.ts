import { ProcessingStatus } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import type {
  IPhotoClassificationWriteRepository,
  PersistFailureInput,
  PersistResultInput,
} from '../../domain/ports'

@Injectable()
export class PhotoClassificationWriteRepository implements IPhotoClassificationWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async persistResult(input: PersistResultInput): Promise<{ processingId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const processing = await tx.photoProcessing.create({
        data: {
          photo_id: input.photoId,
          schema_version: input.processing.schemaVersion,
          status: ProcessingStatus.completed,
          total_ms: input.processing.totalMs,
          model_versions: input.processing.modelVersions,
          started_at: input.processing.startedAt,
          completed_at: input.processing.completedAt,
        },
        select: { id: true },
      })

      if (input.stages.length > 0) {
        await tx.photoProcessingStage.createMany({
          data: input.stages.map((s) => ({
            photo_processing_id: processing.id,
            stage: s.stage,
            status: s.status,
            ms: s.ms,
            items_processed: s.itemsProcessed,
            items_succeeded: s.itemsSucceeded,
            items_failed: s.itemsFailed,
            notes: s.notes,
          })),
        })
      }

      if (input.detections.length > 0) {
        await tx.photoDetection.createMany({
          data: input.detections.map((d) => ({
            photo_id: input.photoId,
            photo_processing_id: processing.id,
            class_name: d.className,
            class_id: d.classId,
            confidence: d.confidence,
            bbox: d.bbox,
          })),
        })
      }

      if (input.bibs.length > 0) {
        await tx.photoBib.createMany({
          data: input.bibs.map((b) => ({
            photo_id: input.photoId,
            photo_processing_id: processing.id,
            source: b.source,
            digits: b.digits,
            confidence: b.confidence,
            confidence_per_digit: b.confidencePerDigit ?? undefined,
            status: b.status,
            rejection_reason: b.rejectionReason,
            raw_ocr_text: b.rawOcrText,
            bbox_source: b.bboxSource ?? undefined,
            preprocessing_applied: b.preprocessingApplied ?? undefined,
            processing_ms: b.processingMs,
          })),
        })
      }

      if (input.colors.length > 0) {
        await tx.photoColor.createMany({
          data: input.colors.map((c) => ({
            photo_id: input.photoId,
            photo_processing_id: processing.id,
            source: c.source,
            region: c.region,
            primary_color: c.primaryColor,
            secondary_color: c.secondaryColor,
            confidence: c.confidence,
            bbox_source: c.bboxSource ?? undefined,
            strategy: c.strategy,
            processing_ms: c.processingMs,
          })),
        })
      }

      return { processingId: processing.id }
    })
  }

  async persistFailure(input: PersistFailureInput): Promise<{ processingId: string }> {
    const processing = await this.prisma.photoProcessing.create({
      data: {
        photo_id: input.photoId,
        schema_version: input.schemaVersion ?? 'unknown',
        status: ProcessingStatus.failed,
        total_ms: 0,
        model_versions: {},
        started_at: input.startedAt,
        completed_at: new Date(),
        error_message: input.errorMessage,
      },
      select: { id: true },
    })
    return { processingId: processing.id }
  }
}
