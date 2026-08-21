import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsString, MaxLength } from 'class-validator'

export class GenerateWatermarkPresignedUrlDto {
  @ApiProperty({ example: 'logo.png', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  fileName: string

  @ApiProperty({ example: 'image/png', enum: ['image/png'] })
  @IsIn(['image/png'])
  contentType: string
}

export class ConfirmWatermarkUploadDto {
  @ApiProperty({ example: 'tenants/uuid/watermark/uuid-logo.png', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  storageKey: string
}
