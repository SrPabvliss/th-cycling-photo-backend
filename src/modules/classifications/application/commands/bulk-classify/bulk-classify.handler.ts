import { DetectedCyclist, EquipmentColor, PlateNumber } from '@classifications/domain/entities'
import {
  CYCLIST_WRITE_REPOSITORY,
  type ICyclistWriteRepository,
} from '@classifications/domain/ports'
import type { EquipmentItemType } from '@classifications/domain/value-objects/equipment-item.vo'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { BulkClassifyCommand } from './bulk-classify.command'

@CommandHandler(BulkClassifyCommand)
export class BulkClassifyHandler implements ICommandHandler<BulkClassifyCommand> {
  constructor(
    @Inject(CYCLIST_WRITE_REPOSITORY) private readonly writeRepo: ICyclistWriteRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
  ) {}

  async execute(command: BulkClassifyCommand): Promise<{ classifiedCount: number }> {
    const uniqueIds = [...new Set(command.photoIds)]

    // Validate all photos exist in a single query
    const existingCount = await this.photoReadRepo.countByIds(uniqueIds)

    if (existingCount !== uniqueIds.length) {
      throw AppException.businessRule('classification.some_photos_not_found')
    }

    // Build domain entities for each photo
    const cyclists: DetectedCyclist[] = []
    const plateNumbers: PlateNumber[] = []
    const colors: EquipmentColor[] = []

    for (const photoId of uniqueIds) {
      const cyclist = DetectedCyclist.create({ photoId })
      cyclists.push(cyclist)

      if (command.plateNumber !== null) {
        plateNumbers.push(
          PlateNumber.create({
            detectedCyclistId: cyclist.id,
            number: command.plateNumber,
          }),
        )
      }

      for (const c of command.colors) {
        colors.push(
          EquipmentColor.create({
            detectedCyclistId: cyclist.id,
            itemType: c.itemType as EquipmentItemType,
            colorName: c.colorName,
            colorHex: c.colorHex,
          }),
        )
      }
    }

    await this.writeRepo.bulkClassify({
      photoIds: uniqueIds,
      cyclists,
      plateNumbers,
      colors,
    })

    return { classifiedCount: uniqueIds.length }
  }
}
