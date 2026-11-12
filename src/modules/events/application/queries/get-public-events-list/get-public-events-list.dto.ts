import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator'

export interface PublicEventListFilters {
  search: string | null
  eventTypeId: number | null
  hasPhotos: boolean
}

export class GetPublicEventsListDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Partial match on the event, canton or province name. Ignores case and accents; % and _ are literal',
    example: 'tungurahua',
    minLength: 2,
    maxLength: 100,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  @IsOptional()
  search?: string

  @ApiPropertyOptional({ description: 'Only events of this event type', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  eventTypeId?: number

  @ApiPropertyOptional({
    description: 'true keeps only events with at least one photo; false does not filter',
    enum: ['true', 'false'],
    example: 'true',
  })
  // Reads the raw `obj[key]`: the global pipe's implicit conversion has already turned `value`
  // into Boolean('false') === true by the time this runs.
  @Transform(({ obj, key }) => {
    const raw: unknown = obj[key]
    if (raw === 'true' || raw === true) return true
    if (raw === 'false' || raw === false) return false
    return raw
  })
  @IsBoolean()
  @IsOptional()
  hasPhotos?: boolean
}
