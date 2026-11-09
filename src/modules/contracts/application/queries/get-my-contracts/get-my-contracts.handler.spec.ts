import type { ContractProjection } from '../../projections/contract.projection'
import { GetMyContractsHandler } from './get-my-contracts.handler'
import { GetMyContractsQuery } from './get-my-contracts.query'

describe('GetMyContractsHandler', () => {
  it("returns only the caller's own contracts, with eventsUsed counted", async () => {
    const contracts: ContractProjection[] = [
      {
        id: 'contract-1',
        commercialName: 'Vuelta Ambato',
        eventsTotal: 3,
        eventsUsed: 2,
        photosPerEvent: 600,
        status: 'accepted',
        validUntil: '2026-12-31',
        termsVersion: 'v1.3-frozen',
        acceptedAt: new Date('2026-08-01T00:00:00.000Z'),
        holderEmail: 'organizador@test.com',
        holderName: 'Pablo Villacres',
        isBackfill: false,
      },
    ]
    const contractRepo = { listByUser: jest.fn().mockResolvedValue(contracts) }
    const handler = new GetMyContractsHandler(contractRepo as never)

    const result = await handler.execute(new GetMyContractsQuery('user-1'))

    expect(result).toBe(contracts)
    expect(result[0].eventsUsed).toBe(2)
    expect(contractRepo.listByUser).toHaveBeenCalledTimes(1)
    expect(contractRepo.listByUser).toHaveBeenCalledWith('user-1')
  })
})
