import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
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
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(command: UnassignCategoryFromEventCommand): Promise<void> {
    // Ruling 21: this handler previously loaded nothing at all and wrote
    // straight through on a caller-supplied eventId. `photo_category.event
    // .remove` is in the TENANT template, so a tenant holding it could strip
    // another tenant's event of its category assignments. The scoped load is
    // what denies that — 404, not 403, so nothing is disclosed.
    const scope = await this.authz.resolveEventScope(command.unassignedById)
    const event = await this.eventReadRepo.findByIdInScope(command.eventId, scope)
    if (!event) throw AppException.notFound('Event', command.eventId)

    await this.authz.assert(command.unassignedById, 'photo_category.event.remove', event.id)

    await this.writeRepo.unassignFromEvent(event.id, command.photoCategoryId)
  }
}
