import { ApiProperty } from '@nestjs/swagger'
import { IsString, Matches } from 'class-validator'

export class ApplyBibCorrectionDto {
  @ApiProperty({ description: 'New digits value', example: '42' })
  @IsString()
  @Matches(/^[0-9]{1,6}$/)
  newValue!: string
}
