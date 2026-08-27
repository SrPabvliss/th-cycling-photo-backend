import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ContractProjection {
  @ApiProperty() id: string
  @ApiProperty() commercialName: string
  @ApiProperty() eventsTotal: number
  @ApiProperty() eventsUsed: number
  @ApiPropertyOptional({ nullable: true }) photosPerEvent: number | null
  @ApiProperty() status: string
  @ApiProperty({ description: 'Last day (Ecuador time) the contract stays usable, yyyy-MM-dd' })
  validUntil: string
  @ApiProperty() termsVersion: string
  @ApiPropertyOptional({ nullable: true }) acceptedAt: Date | null
  @ApiProperty() holderEmail: string
  @ApiProperty() holderName: string
  @ApiProperty() isBackfill: boolean
}
