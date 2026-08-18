import { ApiProperty } from '@nestjs/swagger'

export class PaymentIntentProjection {
  @ApiProperty({ description: 'Gateway that will process this payment', example: 'payphone' })
  provider: string

  @ApiProperty({
    description: 'Gateway-specific checkout payload, passed through to its SDK unmodified',
    type: 'object',
    additionalProperties: true,
  })
  payload: Record<string, unknown>
}
