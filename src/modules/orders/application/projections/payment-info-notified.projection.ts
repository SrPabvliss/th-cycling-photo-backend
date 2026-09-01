import { ApiProperty } from '@nestjs/swagger'

export class PaymentInfoNotifiedProjection {
  @ApiProperty({ description: 'Order UUID' })
  id: string

  @ApiProperty({
    description: "Pre-filled WhatsApp message carrying the event's own bank account",
  })
  whatsappTemplate: string
}
