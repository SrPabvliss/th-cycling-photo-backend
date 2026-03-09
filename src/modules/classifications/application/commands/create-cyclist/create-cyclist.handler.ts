import { DetectedCyclist, EquipmentColor, PlateNumber } from '@classifications/domain/entities'
import {
  CYCLIST_WRITE_REPOSITORY,
  type ICyclistWriteRepository,
} from '@classifications/domain/ports'
import type { EquipmentItemType } from '@classifications/domain/value-objects/equipment-item.vo'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { CreateCyclistCommand } from './create-cyclist.command'

@CommandHandler(CreateCyclistCommand)
export class CreateCyclistHandler implements ICommandHandler<CreateCyclistCommand> {
  constructor(
    @Inject(CYCLIST_WRITE_REPOSITORY) private readonly writeRepo: ICyclistWriteRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
  ) {}

  async execute(command: CreateCyclistCommand): Promise<EntityIdProjection> {
    const photo = await this.photoReadRepo.findById(command.photoId)
    if (!photo) throw AppException.notFound('Photo', command.photoId)

    const cyclist = DetectedCyclist.create({ photoId: command.photoId })
    await this.writeRepo.saveCyclist(cyclist)

    if (command.plateNumber !== null) {
      const plate = PlateNumber.create({
        detectedCyclistId: cyclist.id,
        number: command.plateNumber,
      })
      await this.writeRepo.savePlateNumber(plate)
    }

    if (command.colors.length > 0) {
      const colors = command.colors.map((c) =>
        EquipmentColor.create({
          detectedCyclistId: cyclist.id,
          itemType: c.itemType as EquipmentItemType,
          colorName: c.colorName,
          colorHex: c.colorHex,
        }),
      )
      await this.writeRepo.saveColors(colors)
    }

    return { id: cyclist.id }
  }
}
