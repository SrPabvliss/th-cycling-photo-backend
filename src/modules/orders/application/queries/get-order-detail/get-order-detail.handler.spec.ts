import { EventPayoutMethod } from '@events/domain/entities'
import type { IEventPayoutMethodRepository } from '@events/domain/ports'
import type { OrderDetailProjection } from '@orders/application/projections'
import type { IOrderReadRepository } from '@orders/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { GetOrderDetailHandler } from './get-order-detail.handler'
import { GetOrderDetailQuery } from './get-order-detail.query'

const activeBankMethod = EventPayoutMethod.fromPersistence({
  id: 'method-1',
  eventId: 'event-1',
  provider: 'bank_transfer',
  isActive: true,
  sortOrder: 0,
  mode: null,
  receiverIdentifier: null,
  bankName: 'Banco Pichincha',
  accountNumber: '1234567890',
  accountType: 'savings',
  accountHolder: 'Tenant Holder',
  holderIdentification: '1710000000',
  sourcePayoutMethodId: 'source-1',
})

const inactivePayphoneMethod = EventPayoutMethod.fromPersistence({
  id: 'method-2',
  eventId: 'event-1',
  provider: 'payphone',
  isActive: false,
  sortOrder: 1,
  mode: 'split_receiver',
  receiverIdentifier: '0991234567',
  bankName: null,
  accountNumber: null,
  accountType: null,
  accountHolder: null,
  holderIdentification: null,
  sourcePayoutMethodId: 'source-2',
})

describe('GetOrderDetailHandler', () => {
  let readRepo: jest.Mocked<Pick<IOrderReadRepository, 'getDetail'>>
  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope' | 'can'>>
  let payoutRepo: jest.Mocked<Pick<IEventPayoutMethodRepository, 'findByEventId'>>
  let handler: GetOrderDetailHandler

  beforeEach(() => {
    readRepo = { getDetail: jest.fn() }
    authz = { resolveEventScope: jest.fn(), can: jest.fn().mockResolvedValue(false) }
    payoutRepo = { findByEventId: jest.fn() }
    handler = new GetOrderDetailHandler(readRepo as never, authz as never, payoutRepo as never)
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

  describe('payout methods', () => {
    const query = new GetOrderDetailQuery('order-1', 'u1')

    beforeEach(() => {
      authz.resolveEventScope.mockResolvedValue(EventScope.unrestricted())
      const detail = { id: 'order-1', eventId: 'event-1' } as unknown as OrderDetailProjection
      readRepo.getDetail.mockResolvedValue(detail)
    })

    it('includes them when the caller may notify payment, omits them otherwise', async () => {
      authz.can.mockResolvedValue(true)
      payoutRepo.findByEventId.mockResolvedValue([activeBankMethod])

      const allowed = await handler.execute(query)
      expect(allowed.payoutMethods).toHaveLength(1)

      authz.can.mockResolvedValue(false)
      const denied = await handler.execute(query)
      expect(denied.payoutMethods).toBeUndefined()
    })

    it('excludes inactive methods', async () => {
      authz.can.mockResolvedValue(true)
      payoutRepo.findByEventId.mockResolvedValue([activeBankMethod, inactivePayphoneMethod])

      const result = await handler.execute(query)

      expect(result.payoutMethods).toHaveLength(1)
      expect(result.payoutMethods?.[0].provider).toBe('bank_transfer')
    })
  })
})
