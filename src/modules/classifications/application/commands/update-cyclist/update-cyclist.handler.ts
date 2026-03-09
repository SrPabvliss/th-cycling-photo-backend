import { EquipmentColor, PlateNumber } from '@classifications/domain/entities'
import {
  CYCLIST_READ_REPOSITORY,
  CYCLIST_WRITE_REPOSITORY,
  type ICyclistReadRepository,
  type ICyclistWriteRepository,
} from '@classifications/domain/ports'
import type { EquipmentItemType } from '@classifications/domain/value-objects/equipment-item.vo'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { UpdateCyclistCommand } from './update-cyclist.command'

@CommandHandler(UpdateCyclistCommand)
export class UpdateCyclistHandler implements ICommandHandler<UpdateCyclistCommand> {
  constructor(
    @Inject(CYCLIST_WRITE_REPOSITORY) private readonly writeRepo: ICyclistWriteRepository,
    @Inject(CYCLIST_READ_REPOSITORY) private readonly readRepo: ICyclistReadRepository,
  ) {}

  async execute(command: UpdateCyclistCommand): Promise<EntityIdProjection> {
    const cyclist = await this.readRepo.findById(command.cyclistId)
    if (!cyclist) throw AppException.notFound('Cyclist', command.cyclistId)

    if (command.plateNumber !== undefined) {
      await this.writeRepo.deletePlateNumberByCyclist(cyclist.id)
      if (command.plateNumber !== null) {
        const plate = PlateNumber.create({
          detectedCyclistId: cyclist.id,
          number: command.plateNumber,
        })
        await this.writeRepo.savePlateNumber(plate)
      }
    }

    if (command.colors !== undefined) {
      await this.writeRepo.deleteColorsByCyclist(cyclist.id)
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
    }

    cyclist.markUpdated()
    await this.writeRepo.saveCyclist(cyclist)

    return { id: cyclist.id }
  }
}
