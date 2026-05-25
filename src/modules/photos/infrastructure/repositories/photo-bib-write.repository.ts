import type { PhotoBib } from '@classifications/domain/entities'
import { Injectable } from '@nestjs/common'
import { type IPhotoBibWriteRepository } from '@photos/domain/ports'
import { PrismaService } from '@shared/infrastructure'

@Injectable()
export class PhotoBibWriteRepository implements IPhotoBibWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(bibId: string): Promise<{ id: string; photoId: string; digits: string } | null> {
    const row = await this.prisma.photoBib.findUnique({
      where: { id: bibId },
      select: { id: true, photo_id: true, digits: true },
    })
    return row ? { id: row.id, photoId: row.photo_id, digits: row.digits } : null
  }

  async save(bib: PhotoBib): Promise<PhotoBib> {
    await this.prisma.photoBib.create({
      data: {
        id: bib.id,
        photo_id: bib.photoId,
        photo_processing_id: bib.photoProcessingId,
        source: bib.source,
        digits: bib.digits,
        confidence: bib.confidence,
        confidence_per_digit: bib.confidencePerDigit ?? undefined,
        status: bib.status,
        rejection_reason: bib.rejectionReason,
        raw_ocr_text: bib.rawOcrText,
        bbox_source: bib.bboxSource ?? undefined,
        preprocessing_applied: bib.preprocessingApplied ?? undefined,
        processing_ms: bib.processingMs,
        crop_path: bib.cropPath,
        created_by_id: bib.createdById,
      },
    })
    return bib
  }

  async softDelete(bibId: string, reviewerId: string): Promise<void> {
    await this.prisma.photoBib.update({
      where: { id: bibId },
      data: { deleted_at: new Date(), deleted_by_id: reviewerId },
    })
  }
}
