import { ApiProperty } from '@nestjs/swagger'

export class PublicEventTypeFilterProjection {
  @ApiProperty({ description: 'Event type id', example: 1 })
  id: number

  @ApiProperty({ description: 'Event type name', example: 'Ciclismo de ruta' })
  name: string
}

export class PublicEventFiltersProjection {
  @ApiProperty({
    description: 'Event types that have at least one publicly listed event, sorted by name',
    type: [PublicEventTypeFilterProjection],
  })
  eventTypes: PublicEventTypeFilterProjection[]
}
