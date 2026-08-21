import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class PayoutMethodProjection {
  @ApiProperty() id: string
  @ApiProperty() provider: string
  @ApiProperty() isActive: boolean
  @ApiProperty() sortOrder: number
  @ApiProperty() status: string
  @ApiPropertyOptional({ nullable: true }) receiverIdentifier: string | null
  @ApiPropertyOptional({ nullable: true }) bankName: string | null
  @ApiPropertyOptional({ nullable: true }) accountNumber: string | null
  @ApiPropertyOptional({ nullable: true }) accountType: string | null
  @ApiPropertyOptional({ nullable: true }) accountHolder: string | null
  @ApiPropertyOptional({ nullable: true }) holderIdentification: string | null
}
