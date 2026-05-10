import { PhotoStatus } from '@generated/prisma/client'
import { ApiProperty } from '@nestjs/swagger'

export class ReviewQueueItemProjection {
  @ApiProperty()
  id: string

  @ApiProperty()
  publicSlug: string

  @ApiProperty()
  filename: string

  @ApiProperty({ nullable: true, type: String })
  thumbnailUrl: string | null

  @ApiProperty({ enum: PhotoStatus })
  status: PhotoStatus

  @ApiProperty({ nullable: true, type: Date })
  reviewedAt: Date | null

  @ApiProperty({ nullable: true, type: Number })
  minBibConfidence: number | null

  @ApiProperty()
  bibsCount: number

  @ApiProperty()
  colorsCount: number
}
