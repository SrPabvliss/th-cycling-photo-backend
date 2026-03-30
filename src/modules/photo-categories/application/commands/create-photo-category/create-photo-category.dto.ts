import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

export class CreatePhotoCategoryDto {
  @ApiProperty({ description: 'Category name (must be globally unique)', example: 'Competencia' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string
}
