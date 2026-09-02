import { FreezeStateService } from '@events/application/services/freeze-state.service'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  EVENT_PRICING_WRITE_REPOSITORY,
  type IEventPricingWriteRepository,
} from '@pricing/domain/ports'
import { PricingTier } from '@pricing/domain/value-objects/pricing-tier.vo'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { SetEventPricingConfigCommand } from './set-event-pricing-config.command'

/**
 * Persists per-event pricing override. DORMANT: the checkout flow does not
 * yet read this value — it uses DEFAULT_PRICING_TIERS at the cart level.
 * Kept ready for future bucket-aware checkout.
 */
@CommandHandler(SetEventPricingConfigCommand)
export class SetEventPricingConfigHandler implements ICommandHandler<SetEventPricingConfigCommand> {
  constructor(
    @Inject(EVENT_PRICING_WRITE_REPOSITORY)
    private readonly repo: IEventPricingWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly freeze: FreezeStateService,
  ) {}

  async execute(cmd: SetEventPricingConfigCommand): Promise<void> {
    // `pricing.config.set` is not platformOnly, so a tenant could be granted it even though no
    // template holds it today — the scoped load is what keeps such a holder inside its own tenant.
    // 404, not 403, so an out-of-scope event's existence isn't disclosed.
    const scope = await this.authz.resolveEventScope(cmd.setById)
    const event = await this.eventReadRepo.findByIdInScope(cmd.eventId, scope)
    if (!event) throw AppException.notFound('entities.event', cmd.eventId)

    await this.authz.assert(cmd.setById, 'pricing.config.set', event.id)
    await this.freeze.assertNotFrozen(event.id)

    const tiers = cmd.config.tiers.map((t) => ({
      minQty: t.minQty,
      maxQty: t.maxQty ?? null,
      pricePerPhoto: t.pricePerPhoto,
    }))
    tiers.forEach((t) => {
      PricingTier.create(t)
    })
    await this.repo.upsertConfig(event.id, { currency: cmd.config.currency, tiers })
  }
}
