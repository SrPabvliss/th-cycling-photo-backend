import { ApiPropertyOptional } from '@nestjs/swagger'
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsUUID } from 'class-validator'

export class ReclassifyPhotosDto {
  @ApiPropertyOptional({
    description:
      'Failed photos to send back to classification; omit to send every failed photo of the event',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  photoIds?: string[]
}
