import { TenantContract } from '../../../domain/entities/tenant-contract.entity'
import { RevokeContractCommand } from './revoke-contract.command'
import { RevokeContractHandler } from './revoke-contract.handler'

describe('RevokeContractHandler', () => {
  let handler: RevokeContractHandler
  let contractRepo: { findById: jest.Mock; revoke: jest.Mock }

  const command = new RevokeContractCommand('contract-1')

  const buildContract = (overrides: Partial<Parameters<typeof TenantContract.rehydrate>[0]> = {}) =>
    TenantContract.rehydrate({
      id: 'contract-1',
      userId: 'user-1',
      tenantId: null,
      commercialName: 'Vuelta Ambato',
      eventsTotal: 1,
      photosPerEvent: 600,
      status: 'pending',
      validUntil: new Date(Date.now() + 86_400_000),
      termsVersion: 'v1.3-frozen',
      acceptedAt: null,
      revokedAt: null,
      ...overrides,
    })

  beforeEach(() => {
    contractRepo = {
      findById: jest.fn(),
      revoke: jest.fn().mockResolvedValue(undefined),
    }
    handler = new RevokeContractHandler(contractRepo as never)
  })

  it('revokes a pending contract', async () => {
    contractRepo.findById.mockResolvedValue(buildContract())

    await handler.execute(command)

    expect(contractRepo.revoke).toHaveBeenCalledTimes(1)
    expect(contractRepo.revoke).toHaveBeenCalledWith('contract-1')
  })

  it('refuses a contract that is not pending', async () => {
    contractRepo.findById.mockResolvedValue(
      buildContract({ status: 'accepted', acceptedAt: new Date() }),
    )

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'contract.not_pending',
    })
    expect(contractRepo.revoke).not.toHaveBeenCalled()
  })

  it('throws entities.tenant_contract not found for an unknown id', async () => {
    contractRepo.findById.mockResolvedValue(null)

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'errors.NOT_FOUND',
    })
    expect(contractRepo.revoke).not.toHaveBeenCalled()
  })
})
