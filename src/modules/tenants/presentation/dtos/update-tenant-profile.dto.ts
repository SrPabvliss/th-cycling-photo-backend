import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateTenantProfileDto {
  @ApiPropertyOptional({ example: 'Ambato Cycling Photos' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  publicName?: string | null

  @ApiPropertyOptional({ example: '+593987654321' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  whatsappNumber?: string | null
}
