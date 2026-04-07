import { ApiProperty } from '@nestjs/swagger'

export class ClassificationProgressProjection {
  @ApiProperty() total: number
  @ApiProperty() classified: number
  @ApiProperty() percentage: number
}

export class RetouchProgressProjection {
  @ApiProperty() pendingOrders: number
  @ApiProperty() pendingPhotos: number
}

export class DashboardSummaryProjection {
  @ApiProperty() assignedEventsCount: number
  @ApiProperty() pendingPhotosCount: number
  @ApiProperty() pendingRetouchCount: number
}

export class ActiveEventProjection {
  @ApiProperty() eventId: string
  @ApiProperty() name: string
  @ApiProperty() date: string
  @ApiProperty() location: string
  @ApiProperty({ nullable: true }) coverUrl: string | null
  @ApiProperty({ type: ClassificationProgressProjection })
  classification: ClassificationProgressProjection
  @ApiProperty({ type: RetouchProgressProjection }) retouch: RetouchProgressProjection
  @ApiProperty() hasProgress: boolean
}

export class CompletedEventProjection {
  @ApiProperty() eventId: string
  @ApiProperty() name: string
  @ApiProperty() location: string
  @ApiProperty() date: string
  @ApiProperty({ nullable: true }) coverUrl: string | null
  @ApiProperty() totalClassified: number
  @ApiProperty() completedAt: string
}

export class RecentActivityProjection {
  @ApiProperty({ enum: ['classification', 'retouch'] }) type: 'classification' | 'retouch'
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
