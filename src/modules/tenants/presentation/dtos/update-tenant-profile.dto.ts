import { ApiPropertyOptional } from '@nestjs/swagger'
import { MAX_PUBLIC_NAME_LENGTH, MIN_PUBLIC_NAME_LENGTH } from '@shared/constants/payout.constants'
import { Transform } from 'class-transformer'
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class UpdateTenantProfileDto {
  @ApiPropertyOptional({ example: 'Ambato Cycling Photos' })
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(MIN_PUBLIC_NAME_LENGTH)
  @MaxLength(MAX_PUBLIC_NAME_LENGTH)
  publicName?: string | null

  @ApiPropertyOptional({ example: '+593987654321' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  whatsappNumber?: string | null
}
