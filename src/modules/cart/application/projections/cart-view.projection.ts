import { ApiProperty } from '@nestjs/swagger'

export class CartViewPhotoProjection {
  @ApiProperty({ description: 'Photo ID' })
  id: string

  @ApiProperty({ description: 'Public slug for building CDN gallery URLs' })
  publicSlug: string
}

export class CartViewEventGroupProjection {
  @ApiProperty({ description: 'Event ID' })
  eventId: string

  @ApiProperty({ description: 'Event name' })
  eventName: string

  @ApiProperty({ description: 'Event start date' })
  startDate: Date

  @ApiProperty({ description: 'Event end date' })
  endDate: Date

  @ApiProperty({ description: 'Photos in this event group', type: [CartViewPhotoProjection] })
  photos: CartViewPhotoProjection[]
}

export type CartViewProjection = CartViewEventGroupProjection[]
