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

  @ApiProperty({ description: 'Event date' })
  eventDate: Date

  @ApiProperty({ description: 'Photos in this event group', type: [CartViewPhotoProjection] })
  photos: CartViewPhotoProjection[]
}

export type CartViewProjection = CartViewEventGroupProjection[]
