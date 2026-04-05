import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class CreateOrderFromGalleryDto {
  @ApiProperty({
    description: 'Photo IDs to order (must belong to the event)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  photoIds: string[]

  @ApiPropertyOptional({
    description: 'Bib number visible in the photos',
    example: '1234',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  bibNumber?: string

  @ApiPropertyOptional({
    description: 'Category name snapshot for the order',
    example: 'Ciclismo de montaña',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  snapCategoryName?: string
}
