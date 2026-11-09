import { ApiProperty } from '@nestjs/swagger'
import {
  PaymentMethod,
  type PaymentMethodType,
} from '@orders/domain/value-objects/payment-method.vo'
import { ArrayNotEmpty, IsArray, IsIn, IsUUID } from 'class-validator'

export class ChoosePaymentMethodDto {
  @ApiProperty({
    description: 'Orders the buyer is paying together',
    type: [String],
    format: 'uuid',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderIds: string[]

  @ApiProperty({ enum: Object.values(PaymentMethod) })
  @IsIn(Object.values(PaymentMethod))
  method: PaymentMethodType
}
