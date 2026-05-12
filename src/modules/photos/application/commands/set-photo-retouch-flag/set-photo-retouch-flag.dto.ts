import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

export class SetPhotoRetouchFlagDto {
  @ApiProperty({
    description: 'Whether the photo requires retouch (true to flag, false to dismiss)',
    example: true,
  })
  @IsBoolean()
  requiresRetouch: boolean
}
