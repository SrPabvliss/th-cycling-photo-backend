import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class ConfirmEventCoverDto {
  @ApiProperty({
    description: 'Storage key returned by the presigned URL endpoint',
    example: 'events/550e8400-e29b-41d4-a716-446655440000/cover/photo.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  storageKey: string
}
