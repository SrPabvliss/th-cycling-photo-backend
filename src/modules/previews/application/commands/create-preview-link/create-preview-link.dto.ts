import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator'

export class CreatePreviewLinkDto {
  @ApiProperty({
    description: 'Photo IDs to include in the preview',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  photoIds: string[]

  @ApiPropertyOptional({
    description: 'Number of days until the link expires (default 7, max 90)',
    example: 7,
    default: 7,
  })
  @IsInt()
  @Min(1)
  @Max(90)
  @IsOptional()
  @Type(() => Number)
  expiresInDays?: number
}
