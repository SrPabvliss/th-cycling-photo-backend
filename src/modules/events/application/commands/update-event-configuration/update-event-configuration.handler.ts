import { EventConfigurationService } from '@events/application/services/event-configuration.service'
import {
  EVENT_PAYOUT_METHOD_REPOSITORY,
  EVENT_READ_REPOSITORY,
  EVENT_WRITE_REPOSITORY,
  type IEventPayoutMethodRepository,
  type IEventReadRepository,
  type IEventWriteRepository,
} from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { UpdateEventConfigurationCommand } from './update-event-configuration.command'

@CommandHandler(UpdateEventConfigurationCommand)
export class UpdateEventConfigurationHandler
  implements ICommandHandler<UpdateEventConfigurationCommand>
{
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_PAYOUT_METHOD_REPOSITORY)
    private readonly payoutRepo: IEventPayoutMethodRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly configService: EventConfigurationService,
  ) {}

  async execute(command: UpdateEventConfigurationCommand): Promise<EntityIdProjection> {
    const scope = await this.authz.resolveEventScope(command.actorUserId)
    const event = await this.readRepo.findByIdInScope(command.id, scope)
    if (!event) throw AppException.notFound('Event', command.id)
    await this.authz.assert(command.actorUserId, 'event.update', event.id)

    event.assertConfigurable()

    const config = await this.configService.materialise(event.tenantId, event.id, command.selection)
    event.applyBrandSnapshot(config.brand)
    event.audit.setUpdatedBy(command.actorUserId)

    await this.writeRepo.save(event)
    await this.payoutRepo.replaceForEvent(event.id, config.payoutMethods)

    return { id: event.id }
  }
}
