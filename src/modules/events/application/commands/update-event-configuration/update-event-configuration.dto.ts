import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator'

export class UpdateEventConfigurationDto {
  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  publicName?: string | null

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @ValidateIf((_, v) => v !== undefined)
  watermarkStorageKey?: string

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
