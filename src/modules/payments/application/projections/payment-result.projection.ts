import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PaymentResultProjection {
  @ApiProperty()
  approved: boolean

  @ApiProperty({ type: [String] })
  orderIds: string[]

  @ApiPropertyOptional({ nullable: true })
  message: string | null
}
