import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

export class CreateEventDto {
  @ApiProperty({ description: 'Name of the cycling event', example: 'Vuelta al Cotopaxi 2026' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name: string

  @ApiProperty({
    description: 'Date when the event takes place',
    example: '2026-06-15T08:00:00.000Z',
  })
  @IsDate()
  @Type(() => Date)
  date: Date

  @ApiPropertyOptional({
    description: 'Optional description of the event',
    example: 'Competencia de ciclismo de montaña en la ruta del volcán Cotopaxi',
  })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string

  @ApiPropertyOptional({
    description: 'Physical location or address of the event',
    example: 'Ambato, Ecuador',
  })
  @IsString()
  @IsOptional()
  location?: string

  @ApiPropertyOptional({
    description: 'Province ID where the event takes place',
    example: 18,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  provinceId?: number

  @ApiPropertyOptional({
    description: 'Canton ID where the event takes place (requires provinceId)',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  cantonId?: number

  @ApiProperty({
    description: 'Event type ID',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  eventTypeId: number
}
