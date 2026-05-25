import { PhotoStatus } from '@generated/prisma/client'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { Type } from 'class-transformer'
import { IsDate, IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator'

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

  @ApiPropertyOptional({
    description:
      'Search by bib digits (partial prefix match, e.g. "14" matches "14", "141", "142")',
    example: '14',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{1,10}$/, { message: 'plateNumber must be 1-10 digits' })
  plateNumber?: string

  @ApiPropertyOptional({
    description: 'Match mode for bib search (default: exact)',
    enum: ['exact', 'starts', 'contains'],
    example: 'exact',
  })
  @IsIn(['exact', 'starts', 'contains'])
  @IsOptional()
  bibMatch?: 'exact' | 'starts' | 'contains'

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
