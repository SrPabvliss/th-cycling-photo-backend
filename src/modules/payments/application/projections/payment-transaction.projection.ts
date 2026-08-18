import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PaymentTransactionProjection {
  @ApiProperty()
  clientTransactionId: string

  @ApiProperty()
  status: string

  @ApiProperty()
  amountCents: number

  @ApiProperty({ type: [String] })
  orderIds: string[]

  @ApiPropertyOptional({ nullable: true })
  failureMessage: string | null
}
