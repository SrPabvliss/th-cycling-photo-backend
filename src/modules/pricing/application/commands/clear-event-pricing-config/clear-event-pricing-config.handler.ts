import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  EVENT_PRICING_WRITE_REPOSITORY,
  type IEventPricingWriteRepository,
} from '@pricing/domain/ports'
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
  ) {}

  async execute(cmd: ClearEventPricingConfigCommand): Promise<void> {
    await this.repo.deleteConfig(cmd.eventId)
  }
}
