import { ApiProperty } from '@nestjs/swagger'

export class OperatorActiveEventReviewStatsProjection {
  @ApiProperty() pendingPhotos: number
  @ApiProperty() totalProcessedPhotos: number
}

export class OperatorActiveEventRetouchStatsProjection {
  @ApiProperty() pendingPhotos: number
}

/**
 * Operator-domain stats over a single active event. Pure operator concern
 * (review + retouch progress), free of event identity/metadata.
 */
export class OperatorActiveEventStatsProjection {
  @ApiProperty({ type: OperatorActiveEventReviewStatsProjection })
  review: OperatorActiveEventReviewStatsProjection

  @ApiProperty({ type: OperatorActiveEventRetouchStatsProjection })
  retouch: OperatorActiveEventRetouchStatsProjection
}
