import { TenantContract } from '../../../domain/entities/tenant-contract.entity'
import { AcceptContractCommand } from './accept-contract.command'
import { AcceptContractHandler } from './accept-contract.handler'

describe('AcceptContractHandler', () => {
  let handler: AcceptContractHandler
  let contractRepo: { findByTokenHash: jest.Mock; acceptInTransaction: jest.Mock }
  let authUserRepo: { getMe: jest.Mock }
  let userReadRepo: { findById: jest.Mock }
  let notificationsService: { emitTenantContractAccepted: jest.Mock }

  const command = new AcceptContractCommand('plaintext-token', 'user-1', '127.0.0.1', 'jest-agent')

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
      issuedById: 'admin-1',
      ...overrides,
    })

  beforeEach(() => {
    contractRepo = {
      findByTokenHash: jest.fn(),
      acceptInTransaction: jest.fn(),
    }
    authUserRepo = {
      getMe: jest.fn().mockResolvedValue({ emailVerified: true }),
    }
    userReadRepo = {
      findById: jest.fn().mockResolvedValue({ id: 'user-1', isActive: true }),
    }
    notificationsService = {
      emitTenantContractAccepted: jest.fn(),
    }

    handler = new AcceptContractHandler(
      contractRepo as never,
      authUserRepo as never,
      userReadRepo as never,
      notificationsService as never,
    )
  })

  it('creates the tenant on a first contract and returns its id', async () => {
    const contract = buildContract()
    contractRepo.findByTokenHash.mockResolvedValue(contract)
    contractRepo.acceptInTransaction.mockResolvedValue({
      tenantId: 'tenant-new',
      tenantCreated: true,
    })

    const result = await handler.execute(command)

    expect(result).toEqual({ tenantId: 'tenant-new' })
    expect(contractRepo.acceptInTransaction).toHaveBeenCalledTimes(1)
    expect(contractRepo.acceptInTransaction).toHaveBeenCalledWith({
      contractId: 'contract-1',
      userId: 'user-1',
      ip: '127.0.0.1',
      userAgent: 'jest-agent',
      termsVersion: 'v1.3-frozen',
      commercialName: 'Vuelta Ambato',
    })
  })

  it('does not create another tenant for a second contract when the user already has one', async () => {
    const contract = buildContract()
    contractRepo.findByTokenHash.mockResolvedValue(contract)
    contractRepo.acceptInTransaction.mockResolvedValue({
      tenantId: 'tenant-existing',
      tenantCreated: false,
    })

    const result = await handler.execute(command)

    expect(result).toEqual({ tenantId: 'tenant-existing' })
    expect(notificationsService.emitTenantContractAccepted).toHaveBeenCalledTimes(1)
    const payload = notificationsService.emitTenantContractAccepted.mock.calls[0][0]
    expect(payload.tenantCreated).toBe(false)
  })

  it('reports tenantCreated exactly as the repository resolved it, immune to a race between the read and the write', async () => {
    const contract = buildContract()
    contractRepo.findByTokenHash.mockResolvedValue(contract)
    contractRepo.acceptInTransaction.mockResolvedValue({
      tenantId: 'tenant-new',
      tenantCreated: true,
    })

    await handler.execute(command)

    const payload = notificationsService.emitTenantContractAccepted.mock.calls[0][0]
    expect(payload).toEqual({
      contractId: 'contract-1',
      commercialName: 'Vuelta Ambato',
      tenantCreated: true,
      acceptedBy: 'user-1',
    })
  })

  it('records the consent at the contract own frozen terms version, not the current policy version', async () => {
    const contract = buildContract({ termsVersion: 'v0.9-old-frozen' })
    contractRepo.findByTokenHash.mockResolvedValue(contract)
    contractRepo.acceptInTransaction.mockResolvedValue({
      tenantId: 'tenant-new',
      tenantCreated: true,
    })

    await handler.execute(command)

    expect(contractRepo.acceptInTransaction.mock.calls[0][0].termsVersion).toBe('v0.9-old-frozen')
  })

  it('throws contract.not_yours when accepting a contract addressed to someone else', async () => {
    const contract = buildContract({ userId: 'other-user' })
    contractRepo.findByTokenHash.mockResolvedValue(contract)

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'contract.not_yours',
    })
    expect(contractRepo.acceptInTransaction).not.toHaveBeenCalled()
  })

  it('throws contract.expired when accepting an expired contract', async () => {
    const contract = buildContract({ validUntil: new Date(Date.now() - 1000) })
    contractRepo.findByTokenHash.mockResolvedValue(contract)

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'contract.expired',
    })
    expect(contractRepo.acceptInTransaction).not.toHaveBeenCalled()
  })

  it('throws contract.email_not_verified when accepting with an unverified email', async () => {
    const contract = buildContract()
    contractRepo.findByTokenHash.mockResolvedValue(contract)
    authUserRepo.getMe.mockResolvedValue({ emailVerified: false })

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'contract.email_not_verified',
    })
    expect(contractRepo.acceptInTransaction).not.toHaveBeenCalled()
  })

  it('throws contract.owner_inactive for a deactivated account instead of relying on login failing', async () => {
    userReadRepo.findById.mockResolvedValue({ id: 'user-1', isActive: false })

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'contract.owner_inactive',
    })
    expect(contractRepo.findByTokenHash).not.toHaveBeenCalled()
    expect(contractRepo.acceptInTransaction).not.toHaveBeenCalled()
  })

  it('accepting twice results in exactly one grant: the repository is called once and its already_accepted throw propagates unchanged', async () => {
    const contract = buildContract()
    contractRepo.findByTokenHash.mockResolvedValue(contract)
    const alreadyAccepted = { messageKey: 'contract.already_accepted' }
    contractRepo.acceptInTransaction.mockRejectedValue(alreadyAccepted)

    await expect(handler.execute(command)).rejects.toBe(alreadyAccepted)
    expect(contractRepo.acceptInTransaction).toHaveBeenCalledTimes(1)
  })

  it('does not fail the acceptance when the notification emit throws', async () => {
    const contract = buildContract()
    contractRepo.findByTokenHash.mockResolvedValue(contract)
    contractRepo.acceptInTransaction.mockResolvedValue({
      tenantId: 'tenant-new',
      tenantCreated: true,
    })
    notificationsService.emitTenantContractAccepted.mockImplementation(() => {
      throw new Error('event bus down')
    })

    const result = await handler.execute(command)

    expect(result).toEqual({ tenantId: 'tenant-new' })
    expect(notificationsService.emitTenantContractAccepted).toHaveBeenCalledTimes(1)
  })

  it('throws entities.tenant_contract not found for an unknown token', async () => {
    contractRepo.findByTokenHash.mockResolvedValue(null)

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'errors.NOT_FOUND',
    })
    expect(contractRepo.acceptInTransaction).not.toHaveBeenCalled()
  })
})
