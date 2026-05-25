import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDate, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator'

export class UpdateEventDto {
  @ApiPropertyOptional({
    description: 'Name of the cycling event',
    example: 'Vuelta al Cotopaxi 2026',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @IsOptional()
  name?: string

  @ApiPropertyOptional({
    description: 'First day of the event (inclusive).',
    example: '2026-06-15T00:00:00.000Z',
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDate?: Date

  @ApiPropertyOptional({
    description: 'Last day of the event (inclusive). Must be >= startDate.',
    example: '2026-06-17T00:00:00.000Z',
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endDate?: Date

  @ApiPropertyOptional({ description: 'Province ID (null to clear)', example: 18, nullable: true })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  provinceId?: number | null

  @ApiPropertyOptional({ description: 'Canton ID (null to clear)', example: 1, nullable: true })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  cantonId?: number | null

  @ApiPropertyOptional({ description: 'Event type ID', example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  eventTypeId?: number
}
