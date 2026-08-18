import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  PaymentAccountStatus,
  type PaymentAccountStatusType,
} from '@payments/domain/value-objects/payment-account-status.vo'
import { PaymentMode, type PaymentModeType } from '@payments/domain/value-objects/payment-mode.vo'

export class PaymentAccountProjection {
  @ApiProperty({ description: 'Gateway this account is registered with', example: 'payphone' })
  provider: string

  @ApiProperty({ enum: Object.values(PaymentMode) })
  mode: PaymentModeType

  @ApiProperty({ enum: Object.values(PaymentAccountStatus) })
  status: PaymentAccountStatusType

  @ApiPropertyOptional({ nullable: true })
  phone: string | null

  @ApiPropertyOptional({ nullable: true })
  storeId: string | null

  @ApiPropertyOptional({ nullable: true, type: Date })
  verifiedAt: Date | null

  @ApiProperty()
  isUsable: boolean
}
