import type { IOrderReadRepository } from '@orders/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { GetPendingRetouchHandler } from './get-pending-retouch.handler'
import { GetPendingRetouchQuery } from './get-pending-retouch.query'

describe('GetPendingRetouchHandler', () => {
  let orderReadRepo: jest.Mocked<Pick<IOrderReadRepository, 'getPendingRetouch'>>
  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope'>>
  let handler: GetPendingRetouchHandler

  beforeEach(() => {
    orderReadRepo = { getPendingRetouch: jest.fn().mockResolvedValue([]) }
    authz = { resolveEventScope: jest.fn() }
    handler = new GetPendingRetouchHandler(orderReadRepo as never, authz as never)
  })

  // Regression proof for the gap Task 11 documented and left open: before
  // this fix, `getPendingRetouch()` took no scope at all, so any caller
  // holding `photo.retouch.read` (staff-only today, but not future-proof)
  // would see every tenant's pending-retouch orders.
  it('restricts pending-retouch orders to events within the caller scope', async () => {
    const scope = new EventScope(false, ['tenant-a'], [])
    authz.resolveEventScope.mockResolvedValue(scope)

    await handler.execute(new GetPendingRetouchQuery('u1'))

    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(orderReadRepo.getPendingRetouch).toHaveBeenCalledWith(scope)
  })

  it('an unrestricted (platform) caller still sees platform-wide pending-retouch orders', async () => {
    const unrestricted = EventScope.unrestricted()
    authz.resolveEventScope.mockResolvedValue(unrestricted)

    await handler.execute(new GetPendingRetouchQuery('platform-1'))

    expect(orderReadRepo.getPendingRetouch).toHaveBeenCalledWith(unrestricted)
  })
})
