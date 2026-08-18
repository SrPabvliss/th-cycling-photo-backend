import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
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
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(command: AssignCategoryToEventCommand): Promise<EntityIdProjection> {
    // Scoped load first (Ruling 21). The previous `findById` was unscoped:
    // `assert` only tests whether the caller holds the permission key, never
    // whether the target event belongs to the caller's tenant, so any tenant
    // knowing another tenant's event UUID could rewrite its category
    // assignments — `photo_category.event.assign` is in the TENANT template.
    // An out-of-scope id must resolve to null (404), not 403, so the
    // existence of the event is not disclosed either.
    const scope = await this.authz.resolveEventScope(command.assignedById)
    const event = await this.eventReadRepo.findByIdInScope(command.eventId, scope)
    if (!event) throw AppException.notFound('Event', command.eventId)

    await this.authz.assert(command.assignedById, 'photo_category.event.assign', event.id)

    const category = await this.readRepo.findById(command.photoCategoryId)
    if (!category) throw AppException.notFound('PhotoCategory', String(command.photoCategoryId))

    const id = await this.writeRepo.assignToEvent(event.id, command.photoCategoryId)
    return { id }
  }
}
