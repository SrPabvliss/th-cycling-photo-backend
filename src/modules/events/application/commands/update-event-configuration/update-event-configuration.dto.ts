import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class UpdateEventConfigurationDto {
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  publicName?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  watermarkStorageKey?: string | null

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  whatsappNumber?: string | null

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  payoutMethodIds?: string[]
}
