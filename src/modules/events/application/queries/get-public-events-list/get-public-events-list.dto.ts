import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { Transform } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateBy,
  type ValidationArguments,
} from 'class-validator'

export interface PublicEventListFilters {
  search: string | null
  eventTypeIds: number[]
  provinceIds: number[]
  /** `YYYY-MM`. Set together with `to`, or both are null. */
  from: string | null
  /** `YYYY-MM`, never before `from`. */
  to: string | null
}

const MAX_IDS_PER_FILTER = 20
/** Largest value an `INTEGER` id column holds; anything above it can never match. */
const MAX_INT4 = 2_147_483_647
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const DIGITS = /^\d+$/

/**
 * `1,2,3` → `[1, 2, 3]`. Reads the raw `obj[key]` so the global pipe's implicit conversion never
 * gets in the way. Anything that is not a comma-separated list of digits is handed on in a shape
 * the validators below reject (a non-array, or an array holding the offending text).
 */
const CommaSeparatedIds = () =>
  Transform(({ obj, key }) => {
    const raw: unknown = obj[key]
    if (typeof raw !== 'string') return raw
    return raw.split(',').map((part) => (DIGITS.test(part) ? Number(part) : part))
  })

/** `to` may not be earlier than `from`. `YYYY-MM` strings sort as the months they name. */
const IsNotBeforeFrom = () =>
  ValidateBy({
    name: 'isNotBeforeFrom',
    validator: {
      validate: (value: unknown, args?: ValidationArguments) => {
        const from = (args?.object as { from?: unknown } | undefined)?.from
        return typeof value !== 'string' || typeof from !== 'string' || value >= from
      },
      defaultMessage: () => 'to must not be earlier than from',
    },
  })

const idsDescription = (what: string) =>
  `Comma-separated ${what} ids; an event matches any of them. Positive integers, no repeats, at most ${MAX_IDS_PER_FILTER}`

/** The filters shared by the public list and its filter options. */
export class PublicEventListFiltersDto {
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

  @ApiPropertyOptional({ description: idsDescription('event type'), type: String, example: '1,2' })
  @CommaSeparatedIds()
  @IsArray()
  @ArrayMaxSize(MAX_IDS_PER_FILTER)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT4, { each: true })
  @IsOptional()
  eventTypeIds?: number[]

  @ApiPropertyOptional({ description: idsDescription('province'), type: String, example: '3,7' })
  @CommaSeparatedIds()
  @IsArray()
  @ArrayMaxSize(MAX_IDS_PER_FILTER)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT4, { each: true })
  @IsOptional()
  provinceIds?: number[]

  @ApiPropertyOptional({
    description:
      'First month (YYYY-MM) of the start date range. Alone, it also closes the range on that month',
    example: '2026-06',
    pattern: MONTH_PATTERN.source,
  })
  @IsString()
  @Matches(MONTH_PATTERN, { message: 'from must be a month in YYYY-MM form' })
  @IsOptional()
  from?: string

  @ApiPropertyOptional({
    description:
      'Last month (YYYY-MM) of the start date range, inclusive; not before from. Alone, it also opens the range on that month',
    example: '2026-08',
    pattern: MONTH_PATTERN.source,
  })
  @IsString()
  @Matches(MONTH_PATTERN, { message: 'to must be a month in YYYY-MM form' })
  @IsNotBeforeFrom()
  @IsOptional()
  to?: string
}

export class GetPublicEventsListDto extends IntersectionType(
  PublicEventListFiltersDto,
  PaginationQueryDto,
) {}

/** A range given by one end only covers that single month. */
export function toPublicEventListFilters(dto: PublicEventListFiltersDto): PublicEventListFilters {
  const from = dto.from ?? dto.to ?? null
  const to = dto.to ?? dto.from ?? null
  return {
    search: dto.search ?? null,
    eventTypeIds: dto.eventTypeIds ?? [],
    provinceIds: dto.provinceIds ?? [],
    from,
    to,
  }
}
