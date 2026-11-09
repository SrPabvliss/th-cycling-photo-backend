import type { ContractProjection } from '../../projections/contract.projection'
import { GetContractsListHandler } from './get-contracts-list.handler'
import { GetContractsListQuery } from './get-contracts-list.query'

describe('GetContractsListHandler', () => {
  it('returns every contract from the repository', async () => {
    const contracts: ContractProjection[] = [
      {
        id: 'contract-1',
        commercialName: 'Vuelta Ambato',
        eventsTotal: 1,
        eventsUsed: 0,
        photosPerEvent: 600,
        status: 'pending',
        validUntil: '2026-12-31',
        termsVersion: 'v1.3-frozen',
        acceptedAt: null,
        holderEmail: 'organizador@test.com',
        holderName: 'Pablo Villacres',
        isBackfill: false,
      },
    ]
    const contractRepo = { listAll: jest.fn().mockResolvedValue(contracts) }
    const handler = new GetContractsListHandler(contractRepo as never)

    const result = await handler.execute(new GetContractsListQuery())

    expect(result).toBe(contracts)
    expect(contractRepo.listAll).toHaveBeenCalledTimes(1)
  })
})
