import type { I18nService } from 'nestjs-i18n'
import type { RecentActivityRow } from '../../domain/ports'
import { toRecentActivityProjection } from './recent-activity.mapper'

describe('toRecentActivityProjection', () => {
  const i18n: jest.Mocked<Pick<I18nService, 'translate'>> = {
    translate: jest.fn().mockReturnValue('Revisaste 24 fotos'),
  }

  it('translates review_other when count > 1', () => {
    const row: RecentActivityRow = {
      id: 'review-e1-12345',
      type: 'review',
      eventId: 'e-1',
      eventName: 'Evento Uno',
      count: 24,
      timestamp: new Date('2026-04-15T12:00:00Z'),
    }
    const result = toRecentActivityProjection(row, i18n as never, 'es')
    expect(i18n.translate).toHaveBeenCalledWith('operator.activity.review_other', {
      lang: 'es',
      args: { count: 24 },
    })
    expect(result).toEqual({
      id: 'review-e1-12345',
      type: 'review',
      eventId: 'e-1',
      eventName: 'Evento Uno',
      count: 24,
      description: 'Revisaste 24 fotos',
      timestamp: '2026-04-15T12:00:00.000Z',
    })
  })

  it('translates review_one when count is 1', () => {
    const row: RecentActivityRow = {
      id: 'review-e1-12346',
      type: 'review',
      eventId: 'e-1',
      eventName: 'Evento Uno',
      count: 1,
      timestamp: new Date('2026-04-15T13:00:00Z'),
    }
    toRecentActivityProjection(row, i18n as never, 'es')
    expect(i18n.translate).toHaveBeenCalledWith('operator.activity.review_one', {
      lang: 'es',
      args: { count: 1 },
    })
  })

  it('translates retouch_other when count > 1', () => {
    const row: RecentActivityRow = {
      id: 'retouch-e1-1',
      type: 'retouch',
      eventId: 'e-1',
      eventName: 'Evento Uno',
      count: 3,
      timestamp: new Date('2026-04-15T14:00:00Z'),
    }
    toRecentActivityProjection(row, i18n as never, 'es')
    expect(i18n.translate).toHaveBeenCalledWith('operator.activity.retouch_other', {
      lang: 'es',
      args: { count: 3 },
    })
  })
})
