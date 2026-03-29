import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

export class SetFeaturedEventDto {
  @ApiProperty({ description: 'Whether to mark this event as featured', example: true })
  @IsBoolean()
  isFeatured: boolean
}
