import { ApiProperty } from '@nestjs/swagger'
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator'

export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'Orders being paid with a single charge',
    type: [String],
    format: 'uuid',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderIds: string[]
}
