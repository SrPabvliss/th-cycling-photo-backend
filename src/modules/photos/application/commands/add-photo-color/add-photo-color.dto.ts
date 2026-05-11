import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { COLOR_PALETTE } from '@shared/constants/color-palette'
import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator'

export class AddPhotoColorDto {
  @ApiProperty({ enum: ['helmet', 'cyclist_clothes', 'bicycle'] })
  @IsIn(['helmet', 'cyclist_clothes', 'bicycle'])
  region!: 'helmet' | 'cyclist_clothes' | 'bicycle'

  @ApiProperty({ enum: COLOR_PALETTE })
  @IsString()
  @IsIn(COLOR_PALETTE as readonly string[])
  primaryColor!: string

  @ApiPropertyOptional({ enum: COLOR_PALETTE, nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.secondaryColor !== null)
  @IsString()
  @IsIn(COLOR_PALETTE as readonly string[])
  secondaryColor?: string | null
}
