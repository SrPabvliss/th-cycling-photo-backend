import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsUUID } from 'class-validator'

export class AssignOperatorDto {
  @ApiProperty({ description: 'Operator user ID to assign', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  userId: string
}
