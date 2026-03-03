import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

export class PhotoBatchItemDto {
  @ApiProperty({ description: 'Original file name', example: 'IMG_001.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string

  @ApiProperty({ description: 'File size in bytes', example: 5242880 })
  @IsNumber()
  @Min(1)
  fileSize: number

  @ApiProperty({
    description: 'Object key returned by presigned URL endpoint',
    example: 'events/550e8400-e29b-41d4-a716-446655440000/abc-123-IMG_001.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  objectKey: string

  @ApiProperty({ description: 'MIME type of the image', example: 'image/jpeg' })
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: string
}

export class ConfirmPhotoBatchDto {
  @ApiProperty({ description: 'Array of photo metadata to confirm', type: [PhotoBatchItemDto] })
  @ValidateNested({ each: true })
  @Type(() => PhotoBatchItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  photos: PhotoBatchItemDto[]
}
