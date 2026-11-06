import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreatePhotoCategoryDto {
  @ApiProperty({
    description: 'Category name, unique (case-insensitive) among the base set and your own',
    example: 'Competencia',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string

  @ApiPropertyOptional({
    description: 'Create a base category for every organizer (requires photo_category.base.manage)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  base?: boolean
}
