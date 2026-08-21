import { EVENT_WRITE_REPOSITORY, type IEventWriteRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { UpdateEventPhotoQuotaCommand } from './update-event-photo-quota.command'

@CommandHandler(UpdateEventPhotoQuotaCommand)
export class UpdateEventPhotoQuotaHandler implements ICommandHandler<UpdateEventPhotoQuotaCommand> {
  constructor(@Inject(EVENT_WRITE_REPOSITORY) private readonly repo: IEventWriteRepository) {}

  async execute(command: UpdateEventPhotoQuotaCommand): Promise<void> {
    await this.repo.updatePhotoQuota(command.eventId, command.quota)
  }
}
