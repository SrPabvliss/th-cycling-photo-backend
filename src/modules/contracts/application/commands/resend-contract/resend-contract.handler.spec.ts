import { TenantContract } from '../../../domain/entities/tenant-contract.entity'
import { ResendContractCommand } from './resend-contract.command'
import { ResendContractHandler } from './resend-contract.handler'

describe('ResendContractHandler', () => {
  let handler: ResendContractHandler
  let contractRepo: { findById: jest.Mock; rotateToken: jest.Mock }
  let authUserRepo: { getMe: jest.Mock }
  let mailService: { enqueue: jest.Mock }
  let configService: { getOrThrow: jest.Mock }

  const command = new ResendContractCommand('contract-1')

  const buildContract = (overrides: Partial<Parameters<typeof TenantContract.rehydrate>[0]> = {}) =>
    TenantContract.rehydrate({
      id: 'contract-1',
      userId: 'user-1',
      tenantId: null,
      commercialName: 'Vuelta Ambato',
      eventsTotal: 1,
      photosPerEvent: 600,
      status: 'pending',
      validUntil: new Date('2026-12-31T23:59:59.000Z'),
      termsVersion: 'v1.3-frozen',
      acceptedAt: null,
      revokedAt: null,
      ...overrides,
    })

  beforeEach(() => {
    contractRepo = {
      findById: jest.fn().mockResolvedValue(buildContract()),
      rotateToken: jest.fn().mockResolvedValue(undefined),
    }
    authUserRepo = {
      getMe: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'organizador@test.com',
        firstName: 'Pablo',
      }),
    }
    mailService = { enqueue: jest.fn().mockResolvedValue(undefined) }
    configService = {
      getOrThrow: jest.fn((key: string) =>
        key === 'app.webBaseUrl' ? 'https://titantv.com.ec' : undefined,
      ),
    }

    handler = new ResendContractHandler(
      contractRepo as never,
      authUserRepo as never,
      mailService as never,
      configService as never,
    )
  })

  it('rotates the token hash on the same contract row rather than creating a new one', async () => {
    await handler.execute(command)

    expect(contractRepo.rotateToken).toHaveBeenCalledTimes(1)
    const [id, tokenHash] = contractRepo.rotateToken.mock.calls[0]
    expect(id).toBe('contract-1')
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('keeps every other field of the contract untouched', async () => {
    const contract = buildContract()
    contractRepo.findById.mockResolvedValue(contract)

    await handler.execute(command)

    expect(contract.commercialName).toBe('Vuelta Ambato')
    expect(contract.eventsTotal).toBe(1)
    expect(contract.photosPerEvent).toBe(600)
    expect(contract.status).toBe('pending')
  })

  it('re-enqueues the invitation mail addressed to the contract owner', async () => {
    const result = await handler.execute(command)

    expect(mailService.enqueue).toHaveBeenCalledTimes(1)
    const job = mailService.enqueue.mock.calls[0][0]
    expect(job.to).toBe('organizador@test.com')
    expect(job.template).toBe('tenant-contract-invitation')
    expect(job.vars.commercialName).toBe('Vuelta Ambato')
    expect(job.vars.url).toBe(result.url)
    expect(job.vars.url).not.toContain('undefined')
  })

  it('mails a token different from any previously issued one', async () => {
    const result = await handler.execute(command)
    const newToken = result.url.split('/contracts/')[1]

    expect(newToken).toMatch(/^[0-9a-f]{64}$/)
  })

  it('refuses to resend a contract that is not pending', async () => {
    contractRepo.findById.mockResolvedValue(
      buildContract({ status: 'accepted', acceptedAt: new Date() }),
    )

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'contract.not_pending',
    })
    expect(contractRepo.rotateToken).not.toHaveBeenCalled()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('refuses to resend a lapsed pending contract, mailing nothing', async () => {
    contractRepo.findById.mockResolvedValue(
      buildContract({ validUntil: new Date(Date.now() - 1000) }),
    )

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'contract.resend_lapsed',
    })
    expect(contractRepo.rotateToken).not.toHaveBeenCalled()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('throws entities.tenant_contract not found for an unknown id', async () => {
    contractRepo.findById.mockResolvedValue(null)

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'errors.NOT_FOUND',
    })
    expect(contractRepo.rotateToken).not.toHaveBeenCalled()
  })
})
