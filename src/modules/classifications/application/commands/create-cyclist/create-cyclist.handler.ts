import {
  DetectedParticipant,
  GearColor,
  ParticipantIdentifier,
} from '@classifications/domain/entities'
import {
  type IParticipantWriteRepository,
  PARTICIPANT_WRITE_REPOSITORY,
} from '@classifications/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { CreateParticipantCommand } from './create-cyclist.command'

@CommandHandler(CreateParticipantCommand)
export class CreateParticipantHandler implements ICommandHandler<CreateParticipantCommand> {
  constructor(
    @Inject(PARTICIPANT_WRITE_REPOSITORY) private readonly writeRepo: IParticipantWriteRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
  ) {}

  async execute(command: CreateParticipantCommand): Promise<EntityIdProjection> {
    const photo = await this.photoReadRepo.findById(command.photoId)
    if (!photo) throw AppException.notFound('Photo', command.photoId)

    const participant = DetectedParticipant.create({ photoId: command.photoId })
    if (command.audit) participant.setCreatedBy(command.audit.userId)
    await this.writeRepo.saveParticipant(participant)

    if (command.identifier !== null) {
      const identifier = ParticipantIdentifier.create({
        detectedParticipantId: participant.id,
        value: command.identifier,
      })
      await this.writeRepo.saveIdentifier(identifier)
    }

    if (command.colors.length > 0) {
      const colors = command.colors.map((c) =>
        GearColor.create({
          detectedParticipantId: participant.id,
          gearTypeId: c.gearTypeId,
          colorName: c.colorName,
          colorHex: c.colorHex,
        }),
      )
      await this.writeRepo.saveColors(colors)
    }

    return { id: participant.id }
  }
}
