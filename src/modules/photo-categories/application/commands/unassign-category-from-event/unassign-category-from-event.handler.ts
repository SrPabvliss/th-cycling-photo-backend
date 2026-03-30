import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IPhotoCategoryWriteRepository,
  PHOTO_CATEGORY_WRITE_REPOSITORY,
} from '../../../domain/ports'
import { UnassignCategoryFromEventCommand } from './unassign-category-from-event.command'

@CommandHandler(UnassignCategoryFromEventCommand)
export class UnassignCategoryFromEventHandler
  implements ICommandHandler<UnassignCategoryFromEventCommand>
{
  constructor(
    @Inject(PHOTO_CATEGORY_WRITE_REPOSITORY)
    private readonly writeRepo: IPhotoCategoryWriteRepository,
  ) {}

  async execute(command: UnassignCategoryFromEventCommand): Promise<void> {
    await this.writeRepo.unassignFromEvent(command.eventId, command.photoCategoryId)
  }
}
