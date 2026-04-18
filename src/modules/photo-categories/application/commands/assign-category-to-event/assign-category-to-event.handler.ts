import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import {
  type IPhotoCategoryReadRepository,
  type IPhotoCategoryWriteRepository,
  PHOTO_CATEGORY_READ_REPOSITORY,
  PHOTO_CATEGORY_WRITE_REPOSITORY,
} from '../../../domain/ports'
import { AssignCategoryToEventCommand } from './assign-category-to-event.command'

@CommandHandler(AssignCategoryToEventCommand)
export class AssignCategoryToEventHandler implements ICommandHandler<AssignCategoryToEventCommand> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_CATEGORY_READ_REPOSITORY) private readonly readRepo: IPhotoCategoryReadRepository,
    @Inject(PHOTO_CATEGORY_WRITE_REPOSITORY)
    private readonly writeRepo: IPhotoCategoryWriteRepository,
  ) {}

  async execute(command: AssignCategoryToEventCommand): Promise<EntityIdProjection> {
    const event = await this.eventReadRepo.findById(command.eventId)
    if (!event) throw AppException.notFound('Event', command.eventId)

    const category = await this.readRepo.findById(command.photoCategoryId)
    if (!category) throw AppException.notFound('PhotoCategory', String(command.photoCategoryId))

    const id = await this.writeRepo.assignToEvent(command.eventId, command.photoCategoryId)
    return { id }
  }
}
