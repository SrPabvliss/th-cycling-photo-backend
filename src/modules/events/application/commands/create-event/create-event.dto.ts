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
    description: 'First day of the event (inclusive). May be in the past.',
    example: '2026-06-15T00:00:00.000Z',
  })
  @IsDate()
  @Type(() => Date)
  startDate: Date

  @ApiProperty({
    description: 'Last day of the event (inclusive). Must be >= startDate.',
    example: '2026-06-17T00:00:00.000Z',
  })
  @IsDate()
  @Type(() => Date)
  endDate: Date

  @ApiPropertyOptional({ description: 'Province ID where the event takes place', example: 18 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  provinceId?: number

  @ApiPropertyOptional({
    description: 'Canton ID where the event takes place. Optional even when provinceId is set.',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  cantonId?: number

  @ApiProperty({ description: 'Event type ID', example: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  eventTypeId: number
}
