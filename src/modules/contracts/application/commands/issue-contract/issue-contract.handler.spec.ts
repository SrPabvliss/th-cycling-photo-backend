import { IssueContractCommand } from './issue-contract.command'
import { IssueContractHandler } from './issue-contract.handler'

describe('IssueContractHandler', () => {
  let handler: IssueContractHandler
  let authUserRepo: { findForPasswordReset: jest.Mock }
  let contractRepo: { findPendingByUserId: jest.Mock; create: jest.Mock }
  let mailService: { enqueue: jest.Mock }
  let configService: { getOrThrow: jest.Mock }

  beforeEach(() => {
    authUserRepo = { findForPasswordReset: jest.fn() }
    contractRepo = {
      findPendingByUserId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(undefined),
    }
    mailService = { enqueue: jest.fn().mockResolvedValue(undefined) }
    configService = {
      getOrThrow: jest.fn((key: string) =>
        key === 'app.webBaseUrl' ? 'https://titantv.com.ec' : undefined,
      ),
    }

    handler = new IssueContractHandler(
      authUserRepo as never,
      contractRepo as never,
      mailService as never,
      configService as never,
    )
  })

  const validUntil = new Date('2026-12-31T23:59:59.000Z')
  const command = new IssueContractCommand(
    'organizador@test.com',
    'Vuelta Ambato',
    1,
    600,
    validUntil,
    'admin-1',
  )

  it('issues a contract, returns a URL with the plaintext token, and stores a hash that is not the plaintext', async () => {
    authUserRepo.findForPasswordReset.mockResolvedValue({
      id: 'user-1',
      firstName: 'Pablo',
      isActive: true,
    })

    const result = await handler.execute(command)

    expect(contractRepo.create).toHaveBeenCalledTimes(1)
    const [contract, tokenHash] = contractRepo.create.mock.calls[0]
    expect(contract.userId).toBe('user-1')
    expect(contract.commercialName).toBe('Vuelta Ambato')
    expect(contract.eventsTotal).toBe(1)
    expect(contract.photosPerEvent).toBe(600)

    expect(result.id).toBe(contract.id)
    expect(result.url).toMatch(/^https:\/\/titantv\.com\.ec\/contracts\/[0-9a-f]{64}$/)

    const token = result.url.split('/contracts/')[1]
    expect(tokenHash).not.toBe(token)
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('throws contract.owner_not_found for an unknown email', async () => {
    authUserRepo.findForPasswordReset.mockResolvedValue(null)

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'contract.owner_not_found',
    })
    expect(contractRepo.create).not.toHaveBeenCalled()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('throws contract.owner_inactive for a deactivated account', async () => {
    authUserRepo.findForPasswordReset.mockResolvedValue({
      id: 'user-1',
      firstName: 'Pablo',
      isActive: false,
    })

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'contract.owner_inactive',
    })
    expect(contractRepo.findPendingByUserId).not.toHaveBeenCalled()
    expect(contractRepo.create).not.toHaveBeenCalled()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('throws contract.owner_has_pending_contract when the owner already holds a pending link', async () => {
    authUserRepo.findForPasswordReset.mockResolvedValue({
      id: 'user-1',
      firstName: 'Pablo',
      isActive: true,
    })
    contractRepo.findPendingByUserId.mockResolvedValue({ id: 'existing-contract' })

    await expect(handler.execute(command)).rejects.toMatchObject({
      messageKey: 'contract.owner_has_pending_contract',
    })
    expect(contractRepo.create).not.toHaveBeenCalled()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('enqueues the mail once, addressed to the owner, with the contract terms', async () => {
    authUserRepo.findForPasswordReset.mockResolvedValue({
      id: 'user-1',
      firstName: 'Pablo',
      isActive: true,
    })

    const result = await handler.execute(command)

    expect(mailService.enqueue).toHaveBeenCalledTimes(1)
    const job = mailService.enqueue.mock.calls[0][0]
    expect(job.to).toBe('organizador@test.com')
    expect(job.template).toBe('tenant-contract-invitation')
    expect(job.subject).toBe('Tu contrato de servicio en TitanTV')
    expect(job.vars.firstName).toBe('Pablo')
    expect(job.vars.commercialName).toBe('Vuelta Ambato')
    expect(job.vars.eventsTotal).toBe('1')
    expect(job.vars.photosPerEvent).toBe('600')
    expect(job.vars.url).toBe(result.url)
    expect(job.vars.logoUrl).toBe('https://titantv.com.ec/brand/logo-email.png')
  })

  it('uses a neutral fallback name when the owner has none on file', async () => {
    authUserRepo.findForPasswordReset.mockResolvedValue({
      id: 'user-1',
      firstName: null,
      isActive: true,
    })

    await handler.execute(command)

    expect(mailService.enqueue.mock.calls[0][0].vars.firstName).toBe('organizador')
  })
})
