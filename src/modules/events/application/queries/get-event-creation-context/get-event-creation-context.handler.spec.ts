import type { IUserReadRepository } from '@users/domain/ports'
import { TenantContract } from '../../../../contracts/domain/entities/tenant-contract.entity'
import type { IContractRepository } from '../../../../contracts/domain/ports/contract-repository.port'
import type { ITenantRepository } from '../../../../tenants/domain/ports/tenant-repository.port'
import { GetEventCreationContextHandler } from './get-event-creation-context.handler'
import { GetEventCreationContextQuery } from './get-event-creation-context.query'

describe('GetEventCreationContextHandler', () => {
  let userRepo: jest.Mocked<IUserReadRepository>
  let tenantRepo: jest.Mocked<ITenantRepository>
  let contractRepo: jest.Mocked<IContractRepository>
  let handler: GetEventCreationContextHandler

  const acceptedContract = TenantContract.rehydrate({
    id: 'contract-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    commercialName: 'Vuelta Team',
    eventsTotal: 12,
    photosPerEvent: 4000,
    status: 'accepted',
    validUntil: new Date('2027-01-01'),
    termsVersion: 'v1',
    acceptedAt: new Date('2026-01-01'),
    revokedAt: null,
    issuedById: 'admin-1',
  })

  beforeEach(() => {
    userRepo = {
      findTenantId: jest.fn().mockResolvedValue('tenant-1'),
    } as unknown as jest.Mocked<IUserReadRepository>

    tenantRepo = {
      checkQuota: jest.fn(),
    } as unknown as jest.Mocked<ITenantRepository>

    contractRepo = {
      findNextUsable: jest.fn(),
      findMostRecentAccepted: jest.fn(),
    } as unknown as jest.Mocked<IContractRepository>

    handler = new GetEventCreationContextHandler(userRepo, tenantRepo, contractRepo)
  })

  it('returns requiresContract false and hasSlot true for the platform tenant without consulting the contract repository', async () => {
    tenantRepo.checkQuota.mockResolvedValue({
      isPlatform: true,
      defaultEventPhotoQuota: 5000,
    } as Awaited<ReturnType<ITenantRepository['checkQuota']>>)

    const result = await handler.execute(new GetEventCreationContextQuery('user-1'))

    expect(result).toEqual({
      requiresContract: false,
      hasSlot: true,
      contract: null,
      defaultEventPhotoQuota: 5000,
    })
    expect(contractRepo.findNextUsable).not.toHaveBeenCalled()
    expect(contractRepo.findMostRecentAccepted).not.toHaveBeenCalled()
  })

  it('returns hasSlot true and the contract consumeSlot would take', async () => {
    tenantRepo.checkQuota.mockResolvedValue({
      isPlatform: false,
      defaultEventPhotoQuota: 5000,
    } as Awaited<ReturnType<ITenantRepository['checkQuota']>>)
    contractRepo.findNextUsable.mockResolvedValue({ contract: acceptedContract, eventsUsed: 9 })

    const result = await handler.execute(new GetEventCreationContextQuery('user-1'))

    expect(result.requiresContract).toBe(true)
    expect(result.hasSlot).toBe(true)
    expect(result.contract).toMatchObject({ eventsTotal: 12, eventsUsed: 9, photosPerEvent: 4000 })
    expect(contractRepo.findMostRecentAccepted).not.toHaveBeenCalled()
  })

  it('returns hasSlot false with the most recent contract when every contract is full or expired', async () => {
    tenantRepo.checkQuota.mockResolvedValue({
      isPlatform: false,
      defaultEventPhotoQuota: 5000,
    } as Awaited<ReturnType<ITenantRepository['checkQuota']>>)
    contractRepo.findNextUsable.mockResolvedValue(null)
    contractRepo.findMostRecentAccepted.mockResolvedValue({
      contract: acceptedContract,
      eventsUsed: 12,
    })

    const result = await handler.execute(new GetEventCreationContextQuery('user-1'))

    expect(result.requiresContract).toBe(true)
    expect(result.hasSlot).toBe(false)
    expect(result.contract).toMatchObject({ eventsTotal: 12, eventsUsed: 12, photosPerEvent: 4000 })
  })

  it('returns hasSlot false with a null contract when the tenant has no accepted contract at all', async () => {
    tenantRepo.checkQuota.mockResolvedValue({
      isPlatform: false,
      defaultEventPhotoQuota: 5000,
    } as Awaited<ReturnType<ITenantRepository['checkQuota']>>)
    contractRepo.findNextUsable.mockResolvedValue(null)
    contractRepo.findMostRecentAccepted.mockResolvedValue(null)

    const result = await handler.execute(new GetEventCreationContextQuery('user-1'))

    expect(result.requiresContract).toBe(true)
    expect(result.hasSlot).toBe(false)
    expect(result.contract).toBeNull()
  })

  it('throws when the actor has no tenant', async () => {
    userRepo.findTenantId.mockResolvedValue(null)

    await expect(handler.execute(new GetEventCreationContextQuery('user-1'))).rejects.toThrow()
  })
})
