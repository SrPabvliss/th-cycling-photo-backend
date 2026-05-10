import { EventSummaryProjection } from '@events/application/projections'
import { ApiProperty } from '@nestjs/swagger'
import { OperatorCompletedEventStatsProjection } from './operator-completed-event-stats.projection'

/**
 * Composite projection returned by GET /operator/dashboard/events/completed.
 * Joins event identity with operator-domain completion stats.
 */
export class OperatorCompletedEventProjection {
  @ApiProperty({ type: EventSummaryProjection })
  event: EventSummaryProjection

  @ApiProperty({ type: OperatorCompletedEventStatsProjection })
  stats: OperatorCompletedEventStatsProjection
}
