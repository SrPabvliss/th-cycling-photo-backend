import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PayoutMethodProjection } from '@tenants/application/projections/payout-method.projection'

export class EventConfigurationPresetProjection {
  @ApiPropertyOptional({ nullable: true }) publicName: string | null
  @ApiPropertyOptional({ nullable: true }) watermarkStorageKey: string | null
  @ApiPropertyOptional({ nullable: true }) whatsappNumber: string | null
  @ApiProperty({ type: [PayoutMethodProjection] }) availablePayoutMethods: PayoutMethodProjection[]
}

export class EventPayoutMethodProjection {
  @ApiProperty() id: string
  @ApiProperty() provider: string
  @ApiProperty() isActive: boolean
  @ApiProperty() sortOrder: number
  @ApiPropertyOptional({ nullable: true }) receiverIdentifier: string | null
  @ApiPropertyOptional({ nullable: true }) bankName: string | null
  @ApiPropertyOptional({ nullable: true }) accountNumber: string | null
  @ApiPropertyOptional({ nullable: true }) accountType: string | null
  @ApiPropertyOptional({ nullable: true }) accountHolder: string | null
  @ApiPropertyOptional({ nullable: true }) holderIdentification: string | null
  @ApiPropertyOptional({ nullable: true }) sourcePayoutMethodId: string | null
}

export class EventConfigurationProjection {
  @ApiPropertyOptional({ nullable: true }) publicName: string | null
  @ApiPropertyOptional({ nullable: true }) watermarkStorageKey: string | null
  @ApiPropertyOptional({ nullable: true }) whatsappNumber: string | null
  @ApiProperty({ type: [EventPayoutMethodProjection] }) payoutMethods: EventPayoutMethodProjection[]
  @ApiProperty() isEditable: boolean
}
