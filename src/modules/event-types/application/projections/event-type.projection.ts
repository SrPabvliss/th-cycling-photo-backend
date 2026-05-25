import { ApiProperty } from '@nestjs/swagger'

export class EventTypeProjection {
  @ApiProperty({ description: 'Event type ID', example: 1 })
  id: number

  @ApiProperty({ description: 'Event type name', example: 'Downhill' })
  name: string
}
