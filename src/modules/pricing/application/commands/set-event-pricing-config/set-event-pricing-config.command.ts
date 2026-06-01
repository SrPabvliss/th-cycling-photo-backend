import type { RawPricingConfig } from '@pricing/domain/ports'

export class SetEventPricingConfigCommand {
  constructor(
    public readonly eventId: string,
    public readonly config: RawPricingConfig,
  ) {}
}
