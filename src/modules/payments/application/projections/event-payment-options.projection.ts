import { ApiProperty } from '@nestjs/swagger'

export class EventPaymentOptionsProjection {
  @ApiProperty({
    description: 'Whether the event has a usable Payphone account to collect a card payment',
    example: true,
  })
  cardAvailable: boolean
}
