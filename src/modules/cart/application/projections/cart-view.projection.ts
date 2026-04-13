import { ApiProperty } from '@nestjs/swagger'

export class CartViewPhotoProjection {
  @ApiProperty({ description: 'Photo ID' })
  id: string

  @ApiProperty({ description: 'Watermarked photo URL' })
  url: string

  @ApiProperty({ description: 'Photo width in pixels', nullable: true })
  width: number | null

  @ApiProperty({ description: 'Photo height in pixels', nullable: true })
  height: number | null
}

export class CartViewEventGroupProjection {
  @ApiProperty({ description: 'Event ID' })
  eventId: string

  @ApiProperty({ description: 'Event name' })
  eventName: string

  @ApiProperty({ description: 'Event date' })
  eventDate: Date

  @ApiProperty({ description: 'Event type ID' })
  eventTypeId: number

  @ApiProperty({ description: 'Event cover public /assets/ URL', nullable: true })
  coverUrl: string | null

  @ApiProperty({
    description: 'Cover asset public slug (for cdn-cgi/image transforms)',
    nullable: true,
  })
  coverSlug: string | null

  @ApiProperty({ description: 'Photos in this event group', type: [CartViewPhotoProjection] })
  photos: CartViewPhotoProjection[]
}

export type CartViewProjection = CartViewEventGroupProjection[]
