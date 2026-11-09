import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, Max, Min } from 'class-validator'

export class SetAssetFocalPointDto {
  @ApiProperty({ description: 'Horizontal focal point, 0 = left, 1 = right', example: 0.5 })
  @IsNumber()
  @Min(0)
  @Max(1)
  focalX: number

  @ApiProperty({ description: 'Vertical focal point, 0 = top, 1 = bottom', example: 0.35 })
  @IsNumber()
  @Min(0)
  @Max(1)
  focalY: number
}
