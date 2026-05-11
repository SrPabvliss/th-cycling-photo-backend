import type { IEventReadRepository } from '@events/domain/ports'
import type { IOperatorReadRepository } from '../../../domain/ports'
import { GetDashboardSummaryHandler } from './get-dashboard-summary.handler'
import { GetDashboardSummaryQuery } from './get-dashboard-summary.query'

describe('GetDashboardSummaryHandler', () => {
  let handler: GetDashboardSummaryHandler
  let operatorRead: jest.Mocked<
    Pick<IOperatorReadRepository, 'countPendingReview' | 'countPendingRetouch'>
  >
  let eventRead: jest.Mocked<Pick<IEventReadRepository, 'getAssignedEventIdsByStatus'>>

  beforeEach(() => {
    operatorRead = {
      countPendingReview: jest.fn(),
      countPendingRetouch: jest.fn(),
    }
    eventRead = {
      getAssignedEventIdsByStatus: jest.fn(),
    }
    handler = new GetDashboardSummaryHandler(operatorRead as never, eventRead as never)
  })

  it('returns zeros when operator has no assigned active events', async () => {
    eventRead.getAssignedEventIdsByStatus.mockResolvedValue([])
    operatorRead.countPendingReview.mockResolvedValue(0)
    operatorRead.countPendingRetouch.mockResolvedValue(0)

    const result = await handler.execute(new GetDashboardSummaryQuery('op-1'))

    expect(eventRead.getAssignedEventIdsByStatus).toHaveBeenCalledWith('op-1', 'active')
    expect(operatorRead.countPendingReview).toHaveBeenCalledWith('op-1', [])
    expect(operatorRead.countPendingRetouch).toHaveBeenCalledWith('op-1', [])
    expect(result).toEqual({
      pendingReviewCount: 0,
      pendingRetouchCount: 0,
      assignedEventsCount: 0,
    })
  })

  it('aggregates counts across the assigned event ids', async () => {
    eventRead.getAssignedEventIdsByStatus.mockResolvedValue(['e-1', 'e-2'])
    operatorRead.countPendingReview.mockResolvedValue(12)
    operatorRead.countPendingRetouch.mockResolvedValue(3)

    const result = await handler.execute(new GetDashboardSummaryQuery('op-1'))

    expect(operatorRead.countPendingReview).toHaveBeenCalledWith('op-1', ['e-1', 'e-2'])
    expect(operatorRead.countPendingRetouch).toHaveBeenCalledWith('op-1', ['e-1', 'e-2'])
    expect(result).toEqual({
      pendingReviewCount: 12,
      pendingRetouchCount: 3,
      assignedEventsCount: 2,
    })
  })
})
