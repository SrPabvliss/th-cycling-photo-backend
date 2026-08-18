import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PaymentResultProjection {
  @ApiProperty()
  approved: boolean

  @ApiProperty()
  orderId: string

  @ApiPropertyOptional({ nullable: true })
  message: string | null
}
