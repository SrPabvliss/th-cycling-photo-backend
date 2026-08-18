import type { IOrderReadRepository } from '@orders/domain/ports'
import { Pagination } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { GetOrdersListHandler } from './get-orders-list.handler'
import { GetOrdersListQuery } from './get-orders-list.query'

describe('GetOrdersListHandler', () => {
  let handler: GetOrdersListHandler
  let readRepo: jest.Mocked<Pick<IOrderReadRepository, 'getList'>>
  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope'>>

  beforeEach(() => {
    readRepo = { getList: jest.fn().mockResolvedValue({ items: [], total: 0 }) }
    authz = { resolveEventScope: jest.fn() }
    handler = new GetOrdersListHandler(readRepo as never, authz as never)
  })

  it('restricts orders to events within the caller scope', async () => {
    const scope = new EventScope(false, ['t1'], [])
    authz.resolveEventScope.mockResolvedValue(scope)
    const pagination = new Pagination(1, 20)
    const filters = { eventId: undefined, status: undefined, search: undefined }

    await handler.execute(new GetOrdersListQuery(pagination, filters, 'u1'))

    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(readRepo.getList).toHaveBeenCalledWith(pagination, filters, scope)
  })

  it('passes an unrestricted scope through unchanged for a platform-wide caller', async () => {
    const unrestricted = EventScope.unrestricted()
    authz.resolveEventScope.mockResolvedValue(unrestricted)
    const pagination = new Pagination(1, 20)
    const filters = {}

    await handler.execute(new GetOrdersListQuery(pagination, filters, 'platform-1'))

    expect(readRepo.getList).toHaveBeenCalledWith(pagination, filters, unrestricted)
  })
})
