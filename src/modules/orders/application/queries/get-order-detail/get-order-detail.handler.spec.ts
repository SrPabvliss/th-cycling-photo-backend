import type { OrderDetailProjection } from '@orders/application/projections'
import type { IOrderReadRepository } from '@orders/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { GetOrderDetailHandler } from './get-order-detail.handler'
import { GetOrderDetailQuery } from './get-order-detail.query'

describe('GetOrderDetailHandler', () => {
  let readRepo: jest.Mocked<Pick<IOrderReadRepository, 'getDetail'>>
  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope'>>
  let handler: GetOrderDetailHandler

  beforeEach(() => {
    readRepo = { getDetail: jest.fn() }
    authz = { resolveEventScope: jest.fn() }
    handler = new GetOrderDetailHandler(readRepo as never, authz as never)
  })

  it('returns the order detail when it is within the caller scope', async () => {
    const scope = EventScope.unrestricted()
    authz.resolveEventScope.mockResolvedValue(scope)
    const detail = { id: 'order-1' } as unknown as OrderDetailProjection
    readRepo.getDetail.mockResolvedValue(detail)

    const result = await handler.execute(new GetOrderDetailQuery('order-1', 'u1'))

    expect(readRepo.getDetail).toHaveBeenCalledWith('order-1', scope)
    expect(result).toBe(detail)
  })

  it('throws NOT_FOUND when the order does not exist', async () => {
    authz.resolveEventScope.mockResolvedValue(EventScope.unrestricted())
    readRepo.getDetail.mockResolvedValue(null)

    const error = await handler.execute(new GetOrderDetailQuery('missing', 'u1')).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
  })

  it('throws NOT_FOUND — not FORBIDDEN — when the order exists but its event is outside the caller scope', async () => {
    // The scoped repository call is what enforces the tenant boundary: an
    // out-of-scope order resolves to null exactly like an unknown one, so
    // a caller cannot distinguish "not mine" from "does not exist" and
    // cannot enumerate another tenant's order ids by probing UUIDs.
    const restrictedScope = new EventScope(false, ['my-tenant'], [])
    authz.resolveEventScope.mockResolvedValue(restrictedScope)
    readRepo.getDetail.mockResolvedValue(null)

    const error = await handler
      .execute(new GetOrderDetailQuery('other-tenant-order', 'u1'))
      .catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(readRepo.getDetail).toHaveBeenCalledWith('other-tenant-order', restrictedScope)
  })
})
