import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsNotEmpty, IsPositive, IsString, MaxLength } from 'class-validator'

export class ConfirmPaymentTransactionDto {
  @ApiProperty({ description: 'Identifier this platform generated for the transaction' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  clientTransactionId: string

  @ApiProperty({ description: 'Identifier the gateway assigned to the transaction' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  id: number
}
