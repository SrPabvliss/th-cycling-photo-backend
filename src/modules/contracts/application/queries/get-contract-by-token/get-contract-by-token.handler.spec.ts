import { TenantContract } from '../../../domain/entities/tenant-contract.entity'
import { GetContractByTokenHandler } from './get-contract-by-token.handler'
import { GetContractByTokenQuery } from './get-contract-by-token.query'

describe('GetContractByTokenHandler', () => {
  let handler: GetContractByTokenHandler
  let contractRepo: { findByTokenHash: jest.Mock }
  let authUserRepo: { getMe: jest.Mock }

  const buildContract = (overrides: Partial<Parameters<typeof TenantContract.rehydrate>[0]> = {}) =>
    TenantContract.rehydrate({
      id: 'contract-1',
      userId: 'user-1',
      tenantId: null,
      commercialName: 'Vuelta Ambato',
      eventsTotal: 1,
      photosPerEvent: 600,
      status: 'pending',
      validUntil: new Date('2099-01-01T00:00:00.000Z'),
      termsVersion: 'v1',
      acceptedAt: null,
      revokedAt: null,
      issuedById: 'admin-1',
      ...overrides,
    })

  beforeEach(() => {
    contractRepo = { findByTokenHash: jest.fn() }
    authUserRepo = { getMe: jest.fn().mockResolvedValue({ emailVerified: true }) }

    handler = new GetContractByTokenHandler(contractRepo as never, authUserRepo as never)
  })

  it('returns blockedReason null and the correct numbers for a valid pending contract belonging to the requester', async () => {
    contractRepo.findByTokenHash.mockResolvedValue(buildContract())

    const result = await handler.execute(new GetContractByTokenQuery('token-1', 'user-1'))

    expect(result.blockedReason).toBeNull()
    expect(result.id).toBe('contract-1')
    expect(result.commercialName).toBe('Vuelta Ambato')
    expect(result.eventsTotal).toBe(1)
    expect(result.photosPerEvent).toBe(600)
    expect(result.status).toBe('pending')
  })

  it('returns contract.not_yours and hides the commercial name, numbers, and validity for another user', async () => {
    contractRepo.findByTokenHash.mockResolvedValue(buildContract({ userId: 'someone-else' }))

    const result = await handler.execute(new GetContractByTokenQuery('token-1', 'user-1'))

    expect(result.blockedReason).toBe('contract.not_yours')
    expect(result.commercialName).toBeNull()
    expect(result.eventsTotal).toBeNull()
    expect(result.photosPerEvent).toBeNull()
    expect(result.validUntil).toBeNull()
    expect(result.termsVersion).toBeNull()
    expect(result.status).toBeNull()
    expect(result.id).toBeNull()
  })

  it('returns contract.expired with the numbers intact, since it is the holder own contract', async () => {
    contractRepo.findByTokenHash.mockResolvedValue(
      buildContract({ validUntil: new Date('2020-01-01T00:00:00.000Z') }),
    )

    const result = await handler.execute(new GetContractByTokenQuery('token-1', 'user-1'))

    expect(result.blockedReason).toBe('contract.expired')
    expect(result.commercialName).toBe('Vuelta Ambato')
    expect(result.eventsTotal).toBe(1)
    expect(result.photosPerEvent).toBe(600)
    expect(result.validUntil).toBe('2019-12-31')
  })

  it('throws a not-found error for an unknown token', async () => {
    contractRepo.findByTokenHash.mockResolvedValue(null)

    await expect(
      handler.execute(new GetContractByTokenQuery('bogus-token', 'user-1')),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
