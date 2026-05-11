import { PaginatedResult, Pagination } from '@shared/application'
import type { I18nService } from 'nestjs-i18n'
import type { IOperatorReadRepository, RecentActivityRow } from '../../../domain/ports'
import { GetRecentActivityHandler } from './get-recent-activity.handler'
import { GetRecentActivityQuery } from './get-recent-activity.query'

describe('GetRecentActivityHandler', () => {
  let handler: GetRecentActivityHandler
  let repo: jest.Mocked<Pick<IOperatorReadRepository, 'getRecentActivity'>>
  let i18n: jest.Mocked<Pick<I18nService, 'translate'>>

  beforeEach(() => {
    repo = { getRecentActivity: jest.fn() }
    i18n = { translate: jest.fn().mockReturnValue('Revisaste 1 foto') }
    handler = new GetRecentActivityHandler(repo as never, i18n as never)
  })

  it('returns PaginatedResult with translated descriptions', async () => {
    const row: RecentActivityRow = {
      id: 'review-e1-1',
      type: 'review',
      eventId: 'e-1',
      eventName: 'Evento Uno',
      count: 1,
      timestamp: new Date('2026-04-15T12:00:00Z'),
    }
    repo.getRecentActivity.mockResolvedValue({ items: [row], total: 1 })
    const result = await handler.execute(
      new GetRecentActivityQuery('op-1', new Pagination(1, 10), 'es'),
    )
    expect(repo.getRecentActivity).toHaveBeenCalledWith('op-1', 0, 10)
    expect(result).toBeInstanceOf(PaginatedResult)
    expect(result.items[0]).toMatchObject({
      id: 'review-e1-1',
      description: 'Revisaste 1 foto',
    })
  })
})
