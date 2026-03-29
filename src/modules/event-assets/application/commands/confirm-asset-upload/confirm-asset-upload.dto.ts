import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator'

export class ConfirmAssetUploadDto {
  @ApiProperty({
    description: 'Storage key returned from presigned-url endpoint',
    example: 'events/uuid/assets/cover_image/uuid-banner.jpg',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  storageKey: string

  @ApiPropertyOptional({ description: 'File size in bytes', example: 204800 })
  @IsOptional()
  @IsNumber()
  fileSize?: number

  @ApiPropertyOptional({ description: 'MIME type of the uploaded file', example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mimeType?: string
}
