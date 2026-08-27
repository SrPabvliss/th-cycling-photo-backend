import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ContractOfferProjection {
  @ApiPropertyOptional({ nullable: true }) id: string | null
  @ApiPropertyOptional({ nullable: true }) commercialName: string | null
  @ApiPropertyOptional({ nullable: true }) eventsTotal: number | null
  @ApiPropertyOptional({ nullable: true }) photosPerEvent: number | null
  @ApiPropertyOptional({ nullable: true }) validUntil: string | null
  @ApiPropertyOptional({ nullable: true }) termsVersion: string | null
  @ApiPropertyOptional({ nullable: true }) status: string | null
  @ApiProperty({ nullable: true, type: String }) blockedReason: string | null
}
