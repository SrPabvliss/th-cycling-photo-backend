import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type INotificationWriteRepository,
  NOTIFICATION_WRITE_REPOSITORY,
} from '@notifications/domain/ports'
import type { EntityIdProjection } from '@shared/application'
import { MarkAsReadCommand } from './mark-as-read.command'

@CommandHandler(MarkAsReadCommand)
export class MarkAsReadHandler implements ICommandHandler<MarkAsReadCommand> {
  constructor(
    @Inject(NOTIFICATION_WRITE_REPOSITORY)
    private readonly writeRepo: INotificationWriteRepository,
  ) {}

  async execute(command: MarkAsReadCommand): Promise<EntityIdProjection> {
    await this.writeRepo.markAsRead(command.userId, command.notificationId)
    return { id: command.notificationId }
  }
}
