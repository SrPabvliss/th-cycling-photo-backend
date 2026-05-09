import { ApiProperty } from '@nestjs/swagger'
import { COLOR_PALETTE } from '@shared/constants/color-palette'
import { IsIn, IsString, ValidateIf } from 'class-validator'

const FIELDS = ['primary_color', 'secondary_color'] as const

export class ApplyColorCorrectionDto {
  @ApiProperty({ enum: FIELDS })
  @IsIn(FIELDS)
  field!: 'primary_color' | 'secondary_color'

  @ApiProperty({ enum: COLOR_PALETTE, nullable: true })
  @ValidateIf((o) => o.newValue !== null)
  @IsString()
  @IsIn(COLOR_PALETTE as readonly string[])
  newValue!: string | null
}
