import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  EVENT_PRICING_WRITE_REPOSITORY,
  type IEventPricingWriteRepository,
} from '@pricing/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { ClearEventPricingConfigCommand } from './clear-event-pricing-config.command'

/**
 * Clears per-event pricing override. DORMANT: see SetEventPricingConfigHandler.
 * Kept ready for future bucket-aware checkout.
 */
@CommandHandler(ClearEventPricingConfigCommand)
export class ClearEventPricingConfigHandler
  implements ICommandHandler<ClearEventPricingConfigCommand>
{
  constructor(
    @Inject(EVENT_PRICING_WRITE_REPOSITORY)
    private readonly repo: IEventPricingWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(cmd: ClearEventPricingConfigCommand): Promise<void> {
    // Ruling 21 — see SetEventPricingConfigHandler for the reasoning.
    const scope = await this.authz.resolveEventScope(cmd.clearedById)
    const event = await this.eventReadRepo.findByIdInScope(cmd.eventId, scope)
    if (!event) throw AppException.notFound('Event', cmd.eventId)

    await this.authz.assert(cmd.clearedById, 'pricing.config.clear', event.id)

    await this.repo.deleteConfig(event.id)
  }
}
