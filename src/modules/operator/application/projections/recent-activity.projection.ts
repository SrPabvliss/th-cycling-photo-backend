import { ApiProperty } from '@nestjs/swagger'

export class RecentActivityProjection {
  @ApiProperty() id: string
  @ApiProperty({ enum: ['review', 'retouch'] }) type: 'review' | 'retouch'
  @ApiProperty() eventId: string
  @ApiProperty() eventName: string
  @ApiProperty() count: number
  @ApiProperty() description: string
  @ApiProperty() timestamp: string
}
