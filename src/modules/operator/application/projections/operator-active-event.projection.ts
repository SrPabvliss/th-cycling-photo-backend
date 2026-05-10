import { EventSummaryProjection } from '@events/application/projections'
import { ApiProperty } from '@nestjs/swagger'
import { OperatorActiveEventStatsProjection } from './operator-active-event-stats.projection'

/**
 * Composite projection returned by GET /operator/dashboard/events/active.
 * Joins the event identity (events domain) with the operator-domain stats.
 */
export class OperatorActiveEventProjection {
  @ApiProperty({ type: EventSummaryProjection })
  event: EventSummaryProjection

  @ApiProperty({ type: OperatorActiveEventStatsProjection })
  stats: OperatorActiveEventStatsProjection
}
