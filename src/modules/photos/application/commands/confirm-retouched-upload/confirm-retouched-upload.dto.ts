import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator'

export class ConfirmRetouchedUploadDto {
  @ApiProperty({
    description: 'Object key returned by the presigned URL endpoint',
    example: 'events/550e8400-e29b-41d4-a716-446655440000/retouched/abc-123-IMG_001.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  objectKey: string

  @ApiProperty({ description: 'File size in bytes', example: 5242880 })
  @IsNumber()
  @Min(1)
  fileSize: number
}
