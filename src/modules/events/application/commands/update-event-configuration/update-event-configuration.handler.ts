import { EventConfigurationService } from '@events/application/services/event-configuration.service'
import {
  EVENT_PAYOUT_METHOD_REPOSITORY,
  EVENT_READ_REPOSITORY,
  EVENT_WRITE_REPOSITORY,
  type IEventPayoutMethodRepository,
  type IEventReadRepository,
  type IEventWriteRepository,
} from '@events/domain/ports'
import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { type IKvStorageAdapter, KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import { UpdateEventConfigurationCommand } from './update-event-configuration.command'

@CommandHandler(UpdateEventConfigurationCommand)
export class UpdateEventConfigurationHandler
  implements ICommandHandler<UpdateEventConfigurationCommand>
{
  private readonly logger = new Logger(UpdateEventConfigurationHandler.name)

  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_PAYOUT_METHOD_REPOSITORY)
    private readonly payoutRepo: IEventPayoutMethodRepository,
    @Inject(KV_STORAGE_ADAPTER) private readonly kv: IKvStorageAdapter,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly configService: EventConfigurationService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: UpdateEventConfigurationCommand): Promise<EntityIdProjection> {
    const scope = await this.authz.resolveEventScope(command.actorUserId)
    const event = await this.readRepo.findByIdInScope(command.id, scope)
    if (!event) throw AppException.notFound('Event', command.id)
    await this.authz.assert(command.actorUserId, 'event.update', event.id)

    event.assertConfigurable()

    const existingMethods = await this.payoutRepo.findByEventId(event.id)
    const config = await this.configService.rematerialise(event, command.selection, existingMethods)
    event.applyBrandSnapshot(config.brand)
    event.audit.setUpdatedBy(command.actorUserId)

    const methods = config.payoutMethods
    await this.prisma.$transaction(async (tx) => {
      await this.writeRepo.save(event, tx)
      if (methods) await this.payoutRepo.replaceForEvent(event.id, methods, tx)
    })

    const watermarkKey = config.brand.watermarkStorageKey
    if (watermarkKey) {
      await this.kv.write(`wm-${event.id}`, watermarkKey).catch((err) => {
        this.logger.error(`Failed to update watermark KV entry for event ${event.id}`, err)
      })
    }

    return { id: event.id }
  }
}
