import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  EVENT_PRICING_WRITE_REPOSITORY,
  type IEventPricingWriteRepository,
} from '@pricing/domain/ports'
import { PricingTier } from '@pricing/domain/value-objects/pricing-tier.vo'
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
  ) {}

  async execute(cmd: SetEventPricingConfigCommand): Promise<void> {
    const tiers = cmd.config.tiers.map((t) => ({
      minQty: t.minQty,
      maxQty: t.maxQty ?? null,
      pricePerPhoto: t.pricePerPhoto,
    }))
    tiers.forEach((t) => {
      PricingTier.create(t)
    })
    await this.repo.upsertConfig(cmd.eventId, { currency: cmd.config.currency, tiers })
  }
}
