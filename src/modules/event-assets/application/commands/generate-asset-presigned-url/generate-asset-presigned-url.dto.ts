import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsString, MaxLength } from 'class-validator'

export class GenerateAssetPresignedUrlDto {
  @ApiProperty({ description: 'Original file name', example: 'banner.jpg', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  fileName: string

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'image/jpeg',
    enum: ['image/jpeg', 'image/png', 'image/webp'],
  })
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: string
}
