import { EmailVerificationSendGuard } from '../../services'
import { ResendEmailVerificationCommand } from './resend-email-verification.command'
import { ResendEmailVerificationHandler } from './resend-email-verification.handler'

describe('ResendEmailVerificationHandler', () => {
  let handler: ResendEmailVerificationHandler
  let authUserRepo: { findCredentials: jest.Mock }
  let codeRepo: {
    findLatestUnconsumedByUser: jest.Mock
    create: jest.Mock
    countSentSince: jest.Mock
  }
  let codeService: { generate: jest.Mock }
  let sendGuard: EmailVerificationSendGuard
  let mailService: { enqueue: jest.Mock }
  let configService: { getOrThrow: jest.Mock }

  const pendingCode = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'code-1',
    userId: 'user-1',
    purpose: 'verify_current',
    targetEmail: 'rider@example.com',
    codeHash: 'old-hash',
    expiresAt: new Date(Date.now() + 10 * 60_000),
    consumedAt: null,
    attempts: 0,
    createdAt: new Date(),
    ...overrides,
  })

  beforeEach(() => {
    authUserRepo = {
      findCredentials: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'rider@example.com',
        firstName: 'Pablo',
        isActive: true,
      }),
    }
    codeRepo = {
      findLatestUnconsumedByUser: jest.fn().mockResolvedValue(pendingCode()),
      create: jest.fn().mockResolvedValue(undefined),
      countSentSince: jest.fn().mockResolvedValue(0),
    }
    codeService = {
      generate: jest.fn().mockReturnValue({ code: '111222', hash: 'new-hash' }),
    }
    mailService = { enqueue: jest.fn().mockResolvedValue(undefined) }
    configService = { getOrThrow: jest.fn().mockReturnValue('https://titantv.com.ec') }
    sendGuard = new EmailVerificationSendGuard(codeRepo as never)

    handler = new ResendEmailVerificationHandler(
      authUserRepo as never,
      codeRepo as never,
      codeService as never,
      sendGuard,
      mailService as never,
      configService as never,
    )
  })

  const command = new ResendEmailVerificationCommand('user-1')

  it('should issue a fresh code even when the pending one is still valid', async () => {
    await handler.execute(command)

    expect(codeService.generate).toHaveBeenCalledTimes(1)
    expect(codeRepo.create).toHaveBeenCalledTimes(1)
    expect(mailService.enqueue).toHaveBeenCalledTimes(1)
  })

  it('should reuse the pending purpose and address for the new code', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(
      pendingCode({ expiresAt: new Date(Date.now() - 1000) }),
    )

    await handler.execute(command)

    expect(codeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'verify_current',
        targetEmail: 'rider@example.com',
        codeHash: 'new-hash',
      }),
    )
    const job = mailService.enqueue.mock.calls[0][0]
    expect(job.to).toBe('rider@example.com')
    expect(job.vars.code).toBe('111222')
  })

  it('should reject when there is nothing pending', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(null)

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_verification_not_pending/)
    expect(codeRepo.create).not.toHaveBeenCalled()
  })

  it('should respect the cooldown when resending', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(
      pendingCode({ expiresAt: new Date(Date.now() - 1000) }),
    )
    codeRepo.countSentSince.mockResolvedValueOnce(1)

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_verification_cooldown/)
    expect(codeRepo.create).not.toHaveBeenCalled()
  })

  it('should respect the daily limit when resending', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(
      pendingCode({ expiresAt: new Date(Date.now() - 1000) }),
    )
    codeRepo.countSentSince.mockResolvedValueOnce(0).mockResolvedValueOnce(10)

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_verification_daily_limit/)
    expect(codeRepo.create).not.toHaveBeenCalled()
  })
})
