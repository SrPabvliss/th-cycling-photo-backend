import type { IEventReadRepository } from '@events/domain/ports'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { GetEventsStatsHandler } from './get-events-stats.handler'
import { GetEventsStatsQuery } from './get-events-stats.query'

describe('GetEventsStatsHandler', () => {
  let handler: GetEventsStatsHandler
  let eventReadRepo: jest.Mocked<Pick<IEventReadRepository, 'countAll'>>
  let photoReadRepo: jest.Mocked<Pick<IPhotoReadRepository, 'countAll' | 'sumAllFileSize'>>
  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope'>>

  beforeEach(() => {
    eventReadRepo = { countAll: jest.fn() }
    photoReadRepo = { countAll: jest.fn(), sumAllFileSize: jest.fn() }
    authz = { resolveEventScope: jest.fn() }
    handler = new GetEventsStatsHandler(
      eventReadRepo as never,
      photoReadRepo as never,
      authz as never,
    )
  })

  it('scopes totalEvents, totalPhotos, and totalStorageBytes to the same caller scope (closes the cross-tenant leak — Ruling 20)', async () => {
    // Regression proof: before this fix, `photoReadRepo.countAll()` /
    // `sumAllFileSize()` were called with no arguments at all, so a
    // tenant's own scoped event count was returned beside every tenant's
    // photo count and total storage. Asserting the exact scope instance
    // was passed to all three calls proves the leak is closed, not merely
    // that some object made it through.
    const tenantScope = new EventScope(false, ['tenant-a'], [])
    authz.resolveEventScope.mockResolvedValue(tenantScope)
    eventReadRepo.countAll.mockResolvedValue(3)
    photoReadRepo.countAll.mockResolvedValue(120)
    photoReadRepo.sumAllFileSize.mockResolvedValue(999)

    const result = await handler.execute(new GetEventsStatsQuery('u1'))

    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(eventReadRepo.countAll).toHaveBeenCalledWith(tenantScope)
    expect(photoReadRepo.countAll).toHaveBeenCalledWith(tenantScope)
    expect(photoReadRepo.sumAllFileSize).toHaveBeenCalledWith(tenantScope)
    expect(result).toEqual({ totalEvents: 3, totalPhotos: 120, totalStorageBytes: 999 })
  })

  it('an unrestricted (platform) caller still sees platform-wide totals', async () => {
    const unrestricted = EventScope.unrestricted()
    authz.resolveEventScope.mockResolvedValue(unrestricted)
    eventReadRepo.countAll.mockResolvedValue(50)
    photoReadRepo.countAll.mockResolvedValue(10000)
    photoReadRepo.sumAllFileSize.mockResolvedValue(123456)

    const result = await handler.execute(new GetEventsStatsQuery('platform-admin'))

    expect(eventReadRepo.countAll).toHaveBeenCalledWith(unrestricted)
    expect(photoReadRepo.countAll).toHaveBeenCalledWith(unrestricted)
    expect(photoReadRepo.sumAllFileSize).toHaveBeenCalledWith(unrestricted)
    expect(result).toEqual({ totalEvents: 50, totalPhotos: 10000, totalStorageBytes: 123456 })
  })
})
