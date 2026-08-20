import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class TenantProfileProjection {
  @ApiProperty() id: string
  @ApiProperty() name: string
  @ApiPropertyOptional({ nullable: true }) publicName: string | null
  @ApiPropertyOptional({ nullable: true }) watermarkStorageKey: string | null
  @ApiPropertyOptional({ nullable: true }) whatsappNumber: string | null
  @ApiProperty() whatsappPendingVerification: boolean
}
