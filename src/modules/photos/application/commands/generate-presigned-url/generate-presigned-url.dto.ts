import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export class GeneratePresignedUrlDto {
  @ApiProperty({
    description: 'Original file name',
    example: 'IMG_0001.jpg',
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

  @ApiPropertyOptional({
    description: 'How many files the caller intends to upload in this batch',
    example: 40,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  batchSize?: number
}
