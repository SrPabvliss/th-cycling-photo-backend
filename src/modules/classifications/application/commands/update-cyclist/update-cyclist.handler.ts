import { GearColor, ParticipantIdentifier } from '@classifications/domain/entities'
import {
  type IParticipantReadRepository,
  type IParticipantWriteRepository,
  PARTICIPANT_READ_REPOSITORY,
  PARTICIPANT_WRITE_REPOSITORY,
} from '@classifications/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { UpdateParticipantCommand } from './update-cyclist.command'

@CommandHandler(UpdateParticipantCommand)
export class UpdateParticipantHandler implements ICommandHandler<UpdateParticipantCommand> {
  constructor(
    @Inject(PARTICIPANT_WRITE_REPOSITORY) private readonly writeRepo: IParticipantWriteRepository,
    @Inject(PARTICIPANT_READ_REPOSITORY) private readonly readRepo: IParticipantReadRepository,
  ) {}

  async execute(command: UpdateParticipantCommand): Promise<EntityIdProjection> {
    const participant = await this.readRepo.findById(command.participantId)
    if (!participant) throw AppException.notFound('Participant', command.participantId)

    if (command.identifier !== undefined) {
      await this.writeRepo.deleteIdentifierByParticipant(participant.id)
      if (command.identifier !== null) {
        const identifier = ParticipantIdentifier.create({
          detectedParticipantId: participant.id,
          value: command.identifier,
        })
        await this.writeRepo.saveIdentifier(identifier)
      }
    }

    if (command.colors !== undefined) {
      await this.writeRepo.deleteColorsByParticipant(participant.id)
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
    }

    participant.markUpdated()
    await this.writeRepo.saveParticipant(participant)

    return { id: participant.id }
  }
}
