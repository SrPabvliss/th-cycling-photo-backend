import { ApiProperty } from '@nestjs/swagger'

export class DashboardSummaryProjection {
  @ApiProperty() pendingReviewCount: number
  @ApiProperty() pendingRetouchCount: number
  @ApiProperty() assignedEventsCount: number
}
