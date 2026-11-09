import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean } from 'class-validator'

export class SetEventFreezeDto {
  @ApiProperty({ example: true, description: 'true congela el evento, false lo descongela' })
  @IsBoolean()
  frozen: boolean
}
