import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDate, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator'

const PHOTO_STATUS_VALUES = ['pending', 'detecting', 'analyzing', 'completed', 'failed'] as const

export class SearchPhotosDto {
  @ApiPropertyOptional({ description: 'Filter by event UUID', format: 'uuid' })
  @IsUUID()
  @IsOptional()
  eventId?: string

  @ApiPropertyOptional({
    description: 'Filter by photo status',
    enum: PHOTO_STATUS_VALUES,
    example: 'completed',
  })
  @IsEnum(PHOTO_STATUS_VALUES)
  @IsOptional()
  status?: string

  @ApiPropertyOptional({ description: 'Search by plate number (1-999)', example: 42 })
  @IsInt()
  @Min(1)
  @Max(999)
  @IsOptional()
  @Type(() => Number)
  plateNumber?: number

  @ApiPropertyOptional({
    description: 'Filter photos captured from this date',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  fromDate?: Date

  @ApiPropertyOptional({
    description: 'Filter photos captured until this date',
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  toDate?: Date

  @ApiPropertyOptional({ description: 'Page number (defaults to 1)', example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number

  @ApiPropertyOptional({ description: 'Items per page (defaults to 20, max 100)', example: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number
}
