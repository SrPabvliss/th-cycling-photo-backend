import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@notifications/domain/ports'
import { MarkAllReadCommand } from './mark-all-read.command'

@CommandHandler(MarkAllReadCommand)
export class MarkAllReadHandler implements ICommandHandler<MarkAllReadCommand> {
  constructor(
    @Inject(NOTIFICATION_WRITE_REPOSITORY)
    private readonly writeRepo: INotificationWriteRepository,
  ) {}

  async execute(command: MarkAllReadCommand): Promise<{ updated: number }> {
    const updated = await this.writeRepo.markAllAsRead(command.userId)
    return { updated }
  }
}
