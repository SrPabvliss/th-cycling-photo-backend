import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { EventPaymentOptionsProjection } from '@payments/application/projections'
import { PaymentReceiverResolver } from '@payments/application/services/payment-receiver-resolver.service'
import { GetEventPaymentOptionsQuery } from './get-event-payment-options.query'

@QueryHandler(GetEventPaymentOptionsQuery)
export class GetEventPaymentOptionsHandler implements IQueryHandler<GetEventPaymentOptionsQuery> {
  constructor(private readonly receiverResolver: PaymentReceiverResolver) {}

  async execute(query: GetEventPaymentOptionsQuery): Promise<EventPaymentOptionsProjection> {
    return { cardAvailable: await this.receiverResolver.acceptsCard(query.eventId) }
  }
}
