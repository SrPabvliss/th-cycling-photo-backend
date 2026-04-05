import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength } from 'class-validator'

export class MergeCartDto {
  @ApiProperty({ description: 'Session ID of the anonymous cart to merge' })
  @IsString()
  @MaxLength(64)
  sessionId: string
}
