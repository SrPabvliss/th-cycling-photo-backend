import { ApiProperty } from '@nestjs/swagger'

export class RetouchProgressProjection {
  @ApiProperty() pendingOrders: number
  @ApiProperty() pendingPhotos: number
}

export class DashboardSummaryProjection {
  @ApiProperty() assignedEventsCount: number
  @ApiProperty() pendingRetouchCount: number
}

export class ActiveEventProjection {
  @ApiProperty() eventId: string
  @ApiProperty() name: string
  @ApiProperty() date: string
  @ApiProperty() location: string
  @ApiProperty({ nullable: true }) coverUrl: string | null
  @ApiProperty({ type: RetouchProgressProjection }) retouch: RetouchProgressProjection
}

export class CompletedEventProjection {
  @ApiProperty() eventId: string
  @ApiProperty() name: string
  @ApiProperty() location: string
  @ApiProperty() date: string
  @ApiProperty({ nullable: true }) coverUrl: string | null
  @ApiProperty() totalRetouched: number
  @ApiProperty() completedAt: string
}

export class RecentActivityProjection {
  @ApiProperty({ enum: ['retouch'] }) type: 'retouch'
  @ApiProperty() eventName: string
  @ApiProperty() description: string
  @ApiProperty() timestamp: string
}

export class OperatorDashboardProjection {
  @ApiProperty({ type: DashboardSummaryProjection }) summary: DashboardSummaryProjection
  @ApiProperty({ type: [ActiveEventProjection] }) activeEvents: ActiveEventProjection[]
  @ApiProperty({ type: [CompletedEventProjection] }) completedEvents: CompletedEventProjection[]
  @ApiProperty({ type: [RecentActivityProjection] }) recentActivity: RecentActivityProjection[]
}
