import { DetectedCyclist, EquipmentColor, PlateNumber } from '@classifications/domain/entities'
import {
  CLASSIFICATION_WRITE_REPOSITORY,
  type ClassificationData,
  type IClassificationWriteRepository,
} from '@classifications/domain/ports'
import type { EquipmentItemType } from '@classifications/domain/value-objects/equipment-item.vo'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { ClassifyPhotoCommand } from './classify-photo.command'

@CommandHandler(ClassifyPhotoCommand)
export class ClassifyPhotoHandler implements ICommandHandler<ClassifyPhotoCommand> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository,
    @Inject(CLASSIFICATION_WRITE_REPOSITORY)
    private readonly classificationRepo: IClassificationWriteRepository,
  ) {}

  async execute(command: ClassifyPhotoCommand): Promise<EntityIdProjection> {
    const photo = await this.readRepo.findById(command.photoId)
    if (!photo) throw AppException.notFound('Photo', command.photoId)

    const classifications: ClassificationData[] = command.cyclists.map((cyclistData) => {
      const cyclist = DetectedCyclist.create({
        photoId: photo.id,
        boundingBox: cyclistData.boundingBox,
        confidenceScore: cyclistData.confidenceScore,
      })

      const plate = cyclistData.plateNumber
        ? PlateNumber.create({
            detectedCyclistId: cyclist.id,
            number: cyclistData.plateNumber.number,
            confidenceScore: cyclistData.plateNumber.confidenceScore,
          })
        : null

      const colors = (cyclistData.colors ?? []).map((colorData) =>
        EquipmentColor.create({
          detectedCyclistId: cyclist.id,
          itemType: colorData.itemType as EquipmentItemType,
          colorName: colorData.colorName,
          colorHex: colorData.colorHex,
          densityPercentage: colorData.densityPercentage,
        }),
      )

      return { cyclist, plate, colors }
    })

    photo.markAsCompleted()
    await this.classificationRepo.saveClassification(photo, classifications)

    return { id: photo.id }
  }
}
