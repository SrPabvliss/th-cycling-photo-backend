import type { RawPricingConfig } from './event-pricing-read-repository.port'

export const EVENT_PRICING_WRITE_REPOSITORY = Symbol('EVENT_PRICING_WRITE_REPOSITORY')

export interface IEventPricingWriteRepository {
  upsertConfig(eventId: string, config: RawPricingConfig): Promise<void>
  deleteConfig(eventId: string): Promise<void>
}
