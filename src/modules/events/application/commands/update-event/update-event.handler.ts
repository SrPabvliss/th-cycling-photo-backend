import {
  EVENT_READ_REPOSITORY,
  EVENT_WRITE_REPOSITORY,
  type IEventReadRepository,
  type IEventWriteRepository,
} from '@events/domain/ports'
import { LocationValidator } from '@locations/application/services'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { UpdateEventCommand } from './update-event.command'

@CommandHandler(UpdateEventCommand)
export class UpdateEventHandler implements ICommandHandler<UpdateEventCommand> {
  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly locationValidator: LocationValidator,
  ) {}

  /** Loads an event scoped to the caller's tenant, applies updates, and persists it. */
  async execute(command: UpdateEventCommand): Promise<EntityIdProjection> {
    if (!command.audit) {
      throw AppException.internal('UpdateEventCommand requires an audit context')
    }

    const scope = await this.authz.resolveEventScope(command.audit.userId)
    const event = await this.readRepo.findByIdInScope(command.id, scope)
    if (!event) throw AppException.notFound('entities.event', command.id)
    await this.authz.assert(command.audit.userId, 'event.update', event.id)
    event.assertNotFrozen()

    const provinceId = command.provinceId !== undefined ? command.provinceId : event.provinceId
    const cantonId = command.cantonId !== undefined ? command.cantonId : event.cantonId

    await this.locationValidator.validate(provinceId, cantonId)

    event.update({
      name: command.name,
      startDate: command.startDate,
      endDate: command.endDate,
      provinceId: command.provinceId,
      cantonId: command.cantonId,
      eventTypeId: command.eventTypeId,
    })

    event.audit.setUpdatedBy(command.audit.userId)
    await this.writeRepo.save(event)

    return { id: event.id }
  }
}
