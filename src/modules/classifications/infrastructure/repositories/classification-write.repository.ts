import type {
  ClassificationData,
  IClassificationWriteRepository,
} from '@classifications/domain/ports'
import { Injectable } from '@nestjs/common'
import type { Photo } from '@photos/domain/entities'
import * as PhotoMapper from '@photos/infrastructure/mappers/photo.mapper'
import { PrismaService } from '@shared/infrastructure'
import * as DetectedCyclistMapper from '../mappers/detected-cyclist.mapper'
import * as EquipmentColorMapper from '../mappers/equipment-color.mapper'
import * as PlateNumberMapper from '../mappers/plate-number.mapper'

@Injectable()
export class ClassificationWriteRepository implements IClassificationWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Atomically saves classification results for a photo. */
  async saveClassification(photo: Photo, classifications: ClassificationData[]): Promise<void> {
    const photoData = PhotoMapper.toPersistence(photo)

    await this.prisma.$transaction(async (tx) => {
      await tx.photo.update({
        where: { id: photo.id },
        data: {
          status: photoData.status,
          unclassified_reason: photoData.unclassified_reason,
          processed_at: photoData.processed_at,
        },
      })

      for (const classification of classifications) {
        await tx.detectedCyclist.create({
          data: DetectedCyclistMapper.toPersistence(classification.cyclist),
        })

        if (classification.plate) {
          await tx.plateNumber.create({
            data: PlateNumberMapper.toPersistence(classification.plate),
          })
        }

        if (classification.colors.length > 0) {
          await tx.equipmentColor.createMany({
            data: classification.colors.map(EquipmentColorMapper.toPersistence),
          })
        }
      }
    })
  }
}
