import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateTenantProfileDto {
  @ApiPropertyOptional({ example: 'Ambato Cycling Photos' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  publicName?: string

  @ApiPropertyOptional({ example: 'watermarks/tenant-123.png' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  watermarkStorageKey?: string

  @ApiPropertyOptional({ example: '+593987654321' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  whatsappNumber?: string
}
