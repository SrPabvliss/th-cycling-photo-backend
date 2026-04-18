import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator'

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export class GenerateRetouchedPresignedUrlDto {
  @ApiProperty({
    description: 'Original file name of the retouched photo',
    example: 'IMG_0001_retouched.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'image/jpeg',
    enum: ALLOWED_CONTENT_TYPES,
  })
  @IsString()
  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType: string
}
