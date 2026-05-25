import type { PhotoColor } from '@classifications/domain/entities'
import { Injectable } from '@nestjs/common'
import { type IPhotoColorWriteRepository } from '@photos/domain/ports'
import { PrismaService } from '@shared/infrastructure'

@Injectable()
export class PhotoColorWriteRepository implements IPhotoColorWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(colorId: string): Promise<{
    id: string
    photoId: string
    primaryColor: string
    secondaryColor: string | null
  } | null> {
    const row = await this.prisma.photoColor.findUnique({
      where: { id: colorId },
      select: { id: true, photo_id: true, primary_color: true, secondary_color: true },
    })
    return row
      ? {
          id: row.id,
          photoId: row.photo_id,
          primaryColor: row.primary_color,
          secondaryColor: row.secondary_color,
        }
      : null
  }

  async save(color: PhotoColor): Promise<PhotoColor> {
    await this.prisma.photoColor.create({
      data: {
        id: color.id,
        photo_id: color.photoId,
        photo_processing_id: color.photoProcessingId,
        source: color.source,
        region: color.region,
        primary_color: color.primaryColor,
        secondary_color: color.secondaryColor,
        confidence: color.confidence,
        bbox_source: color.bboxSource ?? undefined,
        strategy: color.strategy,
        processing_ms: color.processingMs,
        crop_path: color.cropPath,
        created_by_id: color.createdById,
      },
    })
    return color
  }

  async softDelete(colorId: string, reviewerId: string): Promise<void> {
    await this.prisma.photoColor.update({
      where: { id: colorId },
      data: { deleted_at: new Date(), deleted_by_id: reviewerId },
    })
  }
}
