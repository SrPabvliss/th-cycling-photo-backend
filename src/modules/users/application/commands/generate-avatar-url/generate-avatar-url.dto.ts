import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator'

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export class GenerateAvatarUrlDto {
  @ApiProperty({
    description: 'Original file name for the avatar image',
    example: 'avatar.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string

  @ApiProperty({
    description: 'MIME type of the avatar image',
    example: 'image/jpeg',
    enum: ALLOWED_CONTENT_TYPES,
  })
  @IsString()
  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType: string
}
