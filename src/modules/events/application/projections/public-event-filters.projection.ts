import { ApiProperty } from '@nestjs/swagger'

const COUNT_DESCRIPTION =
  'Publicly listed events this option would show, with the search and the other filters applied but not this group'

export class PublicEventTypeFilterProjection {
  @ApiProperty({ description: 'Event type id', example: 1 })
  id: number

  @ApiProperty({ description: 'Event type name', example: 'Ciclismo de ruta' })
  name: string

  @ApiProperty({ description: COUNT_DESCRIPTION, example: 4 })
  count: number
}

export class PublicProvinceFilterProjection {
  @ApiProperty({ description: 'Province id', example: 18 })
  id: number

  @ApiProperty({ description: 'Province name', example: 'Tungurahua' })
  name: string

  @ApiProperty({ description: COUNT_DESCRIPTION, example: 2 })
  count: number

  @ApiProperty({
    description: 'The province has at least one publicly listed event, whatever the filters',
    example: true,
  })
  hasEvents: boolean
}

export class PublicMonthFilterProjection {
  @ApiProperty({ description: 'Month of the start date, YYYY-MM', example: '2026-07' })
  month: string

  @ApiProperty({ description: COUNT_DESCRIPTION, example: 3 })
  count: number
}

export class PublicEventFiltersProjection {
  @ApiProperty({
    description:
      'Event types that have at least one publicly listed event, whatever the filters; sorted by name',
    type: [PublicEventTypeFilterProjection],
  })
  eventTypes: PublicEventTypeFilterProjection[]

  @ApiProperty({
    description:
      'Every province of each country that has a publicly listed event, sorted by name. An event without a province counts in none of them',
    type: [PublicProvinceFilterProjection],
  })
  provinces: PublicProvinceFilterProjection[]

  @ApiProperty({
    description:
      'Every month in which a publicly listed event starts, whatever the filters; ascending',
    type: [PublicMonthFilterProjection],
  })
  months: PublicMonthFilterProjection[]
}
