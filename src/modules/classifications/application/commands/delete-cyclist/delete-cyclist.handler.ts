import {
  CYCLIST_READ_REPOSITORY,
  CYCLIST_WRITE_REPOSITORY,
  type ICyclistReadRepository,
  type ICyclistWriteRepository,
} from '@classifications/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { DeleteCyclistCommand } from './delete-cyclist.command'

@CommandHandler(DeleteCyclistCommand)
export class DeleteCyclistHandler implements ICommandHandler<DeleteCyclistCommand> {
  constructor(
    @Inject(CYCLIST_WRITE_REPOSITORY) private readonly writeRepo: ICyclistWriteRepository,
    @Inject(CYCLIST_READ_REPOSITORY) private readonly readRepo: ICyclistReadRepository,
  ) {}

  async execute(command: DeleteCyclistCommand): Promise<EntityIdProjection> {
    const cyclist = await this.readRepo.findById(command.cyclistId)
    if (!cyclist) throw AppException.notFound('Cyclist', command.cyclistId)

    await this.writeRepo.deleteCyclist(command.cyclistId)

    return { id: command.cyclistId }
  }
}
