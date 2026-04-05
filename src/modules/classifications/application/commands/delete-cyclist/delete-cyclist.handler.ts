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
import { DeleteParticipantCommand } from './delete-cyclist.command'

@CommandHandler(DeleteParticipantCommand)
export class DeleteParticipantHandler implements ICommandHandler<DeleteParticipantCommand> {
  constructor(
    @Inject(PARTICIPANT_WRITE_REPOSITORY) private readonly writeRepo: IParticipantWriteRepository,
    @Inject(PARTICIPANT_READ_REPOSITORY) private readonly readRepo: IParticipantReadRepository,
  ) {}

  async execute(command: DeleteParticipantCommand): Promise<EntityIdProjection> {
    const participant = await this.readRepo.findById(command.participantId)
    if (!participant) throw AppException.notFound('Participant', command.participantId)

    await this.writeRepo.deleteParticipant(command.participantId)

    return { id: command.participantId }
  }
}
