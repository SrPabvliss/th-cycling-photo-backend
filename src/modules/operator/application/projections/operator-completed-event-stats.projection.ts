import { ApiProperty } from '@nestjs/swagger'

/**
 * Operator-domain stats for an already-completed event: how many photos were
 * retouched and when the last operator action took place.
 */
export class OperatorCompletedEventStatsProjection {
  @ApiProperty() totalRetouched: number
  @ApiProperty({ nullable: true, type: String }) completedAt: string | null
}
