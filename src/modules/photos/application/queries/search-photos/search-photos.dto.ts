import { PhotoStatus } from '@generated/prisma/client'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { Type } from 'class-transformer'
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'

export class SearchPhotosDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by event UUID', format: 'uuid' })
  @IsUUID()
  @IsOptional()
  eventId?: string

  @ApiPropertyOptional({
    description: 'Filter by photo status',
    enum: PhotoStatus,
    example: PhotoStatus.processed,
  })
  @IsEnum(PhotoStatus)
  @IsOptional()
  status?: PhotoStatus

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

  @ApiPropertyOptional({
    description: 'Filter by helmet color names (comma-separated for multiple, case-insensitive)',
    example: 'Red,Blue',
  })
  @IsString()
  @IsOptional()
  helmetColor?: string

  @ApiPropertyOptional({
    description: 'Filter by clothing color names (comma-separated for multiple, case-insensitive)',
    example: 'Blue,Black',
  })
  @IsString()
  @IsOptional()
  clothingColor?: string

  @ApiPropertyOptional({
    description: 'Filter by bike color names (comma-separated for multiple, case-insensitive)',
    example: 'Black,White',
  })
  @IsString()
  @IsOptional()
  bikeColor?: string
}
