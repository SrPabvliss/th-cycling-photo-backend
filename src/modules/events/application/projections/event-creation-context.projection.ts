import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class EventCreationContextContractProjection {
  @ApiProperty() id: string
  @ApiProperty() commercialName: string
  @ApiProperty() eventsTotal: number
  @ApiProperty() eventsUsed: number
  @ApiPropertyOptional({ nullable: true }) photosPerEvent: number | null
  @ApiProperty() validUntil: Date
}

export class EventCreationContextProjection {
  @ApiProperty() requiresContract: boolean
  @ApiProperty() hasSlot: boolean
  @ApiPropertyOptional({ type: EventCreationContextContractProjection, nullable: true })
  contract: EventCreationContextContractProjection | null
  @ApiPropertyOptional({ nullable: true }) defaultEventPhotoQuota: number | null
}
