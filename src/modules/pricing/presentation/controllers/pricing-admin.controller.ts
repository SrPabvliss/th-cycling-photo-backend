import { Body, Controller, Delete, Param, ParseUUIDPipe, Put } from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ClearEventPricingConfigCommand } from '@pricing/application/commands/clear-event-pricing-config/clear-event-pricing-config.command'
import { SetEventPricingConfigCommand } from '@pricing/application/commands/set-event-pricing-config/set-event-pricing-config.command'
import { SetEventPricingConfigDto } from '@pricing/application/commands/set-event-pricing-config/set-event-pricing-config.dto'
import { Roles } from '@shared/auth'

/**
 * Admin endpoints for managing per-event pricing config (`Event.pricing_config`).
 *
 * STATUS: writes are functional and persisted, but the value is NOT read by
 * the checkout flow yet — checkout uses DEFAULT_PRICING_TIERS at the cart
 * level (see CheckoutCartHandler). These endpoints exist to populate the
 * column for the future bucket-aware checkout. Kept dormant on purpose.
 *
 * Linked follow-up: bucket-aware checkout when overrides go live.
 */
@ApiTags('pricing-admin')
@ApiBearerAuth()
@Controller('admin/events')
export class PricingAdminController {
  constructor(private readonly commandBus: CommandBus) {}

  @Roles('admin')
  @Put(':eventId/pricing-config')
  set(@Param('eventId', ParseUUIDPipe) eventId: string, @Body() dto: SetEventPricingConfigDto) {
    return this.commandBus.execute(
      new SetEventPricingConfigCommand(eventId, { currency: dto.currency, tiers: dto.tiers }),
    )
  }

  @Roles('admin')
  @Delete(':eventId/pricing-config')
  clear(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.commandBus.execute(new ClearEventPricingConfigCommand(eventId))
  }
}
