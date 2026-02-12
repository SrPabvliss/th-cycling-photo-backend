import { ApiProperty } from '@nestjs/swagger'

export class UploadPhotosDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Photo files to upload (JPEG, PNG, or WebP)',
  })
  files: Express.Multer.File[]
}
