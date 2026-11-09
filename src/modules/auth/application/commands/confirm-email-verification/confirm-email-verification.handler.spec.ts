import { ConfirmEmailVerificationCommand } from './confirm-email-verification.command'
import { ConfirmEmailVerificationHandler } from './confirm-email-verification.handler'

describe('ConfirmEmailVerificationHandler', () => {
  let handler: ConfirmEmailVerificationHandler
  let codeRepo: {
    findLatestUnconsumedByUser: jest.Mock
    registerAttempt: jest.Mock
    consume: jest.Mock
  }
  let codeService: { matches: jest.Mock }
  let authUserRepo: {
    markEmailVerified: jest.Mock
    findByEmailExists: jest.Mock
    findCredentials: jest.Mock
    applyEmailChange: jest.Mock
  }
  let mailService: { enqueue: jest.Mock }
  let configService: { getOrThrow: jest.Mock }

  const pendingCode = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'code-1',
    userId: 'user-1',
    purpose: 'verify_current',
    targetEmail: 'rider@example.com',
    codeHash: 'stored-hash',
    expiresAt: new Date(Date.now() + 10 * 60_000),
    consumedAt: null,
    attempts: 0,
    createdAt: new Date(),
    ...overrides,
  })

  beforeEach(() => {
    codeRepo = {
      findLatestUnconsumedByUser: jest.fn().mockResolvedValue(pendingCode()),
      registerAttempt: jest.fn().mockResolvedValue(1),
      consume: jest.fn().mockResolvedValue(undefined),
    }
    codeService = { matches: jest.fn().mockReturnValue(true) }
    authUserRepo = {
      markEmailVerified: jest.fn().mockResolvedValue(undefined),
      findByEmailExists: jest.fn().mockResolvedValue(false),
      findCredentials: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'old@example.com',
        firstName: 'Pablo',
        isActive: true,
        isProtected: false,
      }),
      applyEmailChange: jest.fn().mockResolvedValue(undefined),
    }
    mailService = { enqueue: jest.fn().mockResolvedValue(undefined) }
    configService = { getOrThrow: jest.fn().mockReturnValue('https://titantv.com.ec') }

    handler = new ConfirmEmailVerificationHandler(
      codeRepo as never,
      codeService as never,
      authUserRepo as never,
      mailService as never,
      configService as never,
    )
  })

  const command = new ConfirmEmailVerificationCommand('user-1', '482913')

  it('should mark the email verified and consume the code on a correct verify_current redemption', async () => {
    await handler.execute(command)

    expect(authUserRepo.markEmailVerified).toHaveBeenCalledWith('user-1')
    expect(codeRepo.consume).toHaveBeenCalledWith('user-1')
    expect(codeRepo.registerAttempt).not.toHaveBeenCalled()
    expect(authUserRepo.applyEmailChange).not.toHaveBeenCalled()
  })

  it('should apply the new email, mark it verified, and notify the old address on a correct change_email redemption', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(
      pendingCode({ purpose: 'change_email', targetEmail: 'new@example.com' }),
    )

    await handler.execute(command)

    expect(authUserRepo.markEmailVerified).not.toHaveBeenCalled()
    expect(authUserRepo.applyEmailChange).toHaveBeenCalledWith('user-1', 'new@example.com')
    expect(codeRepo.consume).toHaveBeenCalledWith('user-1')

    expect(mailService.enqueue).toHaveBeenCalledTimes(1)
    const job = mailService.enqueue.mock.calls[0][0]
    expect(job.to).toBe('old@example.com')
    expect(job.template).toBe('email-changed-notice')
    expect(job.vars.newEmail).toBe('new@example.com')
  })

  it('should reject when the target address was taken between the request and the redemption', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(
      pendingCode({ purpose: 'change_email', targetEmail: 'new@example.com' }),
    )
    authUserRepo.findByEmailExists.mockResolvedValue(true)

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_change_target_taken/)
    expect(authUserRepo.applyEmailChange).not.toHaveBeenCalled()
    expect(codeRepo.consume).not.toHaveBeenCalled()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('should keep the email change when the old-address notice fails to queue', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(
      pendingCode({ purpose: 'change_email', targetEmail: 'new@example.com' }),
    )
    mailService.enqueue.mockRejectedValue(new Error('redis is down'))

    await expect(handler.execute(command)).resolves.toBeUndefined()
    expect(authUserRepo.applyEmailChange).toHaveBeenCalledWith('user-1', 'new@example.com')
    expect(codeRepo.consume).toHaveBeenCalledWith('user-1')
  })

  it('should not verify the current email for a change_email purpose code', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(pendingCode({ purpose: 'change_email' }))

    await handler.execute(command)

    expect(authUserRepo.markEmailVerified).not.toHaveBeenCalled()
    expect(codeRepo.consume).toHaveBeenCalledWith('user-1')
  })

  it('should not apply an email change for a verify_current purpose code', async () => {
    await handler.execute(command)

    expect(authUserRepo.applyEmailChange).not.toHaveBeenCalled()
  })

  it('should register an attempt and not verify on a wrong code', async () => {
    codeService.matches.mockReturnValue(false)
    codeRepo.registerAttempt.mockResolvedValue(3)

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_verification_invalid/)
    expect(codeRepo.registerAttempt).toHaveBeenCalledWith('code-1')
    expect(authUserRepo.markEmailVerified).not.toHaveBeenCalled()
    expect(codeRepo.consume).not.toHaveBeenCalled()
  })

  it('should burn the code on the fifth failed attempt', async () => {
    codeService.matches.mockReturnValue(false)
    codeRepo.registerAttempt.mockResolvedValue(5)

    await expect(handler.execute(command)).rejects.toThrow(
      /auth.email_verification_no_attempts_left/,
    )
    expect(codeRepo.consume).toHaveBeenCalledWith('user-1')
  })

  it('should reject an expired code with a distinct key from an invalid one', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(
      pendingCode({ expiresAt: new Date(Date.now() - 1000) }),
    )

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_verification_expired/)
    expect(codeService.matches).not.toHaveBeenCalled()
    expect(codeRepo.registerAttempt).not.toHaveBeenCalled()
  })

  it('should reject when there is no pending code', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(null)

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_verification_not_pending/)
    expect(codeService.matches).not.toHaveBeenCalled()
  })

  it('should burn the code without comparing it when attempts are already at the limit', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(pendingCode({ attempts: 5 }))

    await expect(handler.execute(command)).rejects.toThrow(
      /auth.email_verification_no_attempts_left/,
    )
    expect(codeService.matches).not.toHaveBeenCalled()
    expect(codeRepo.registerAttempt).not.toHaveBeenCalled()
    expect(codeRepo.consume).toHaveBeenCalledWith('user-1')
  })

  it('should reject a change_email redemption when the account was deactivated after the request', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(
      pendingCode({ purpose: 'change_email', targetEmail: 'new@example.com' }),
    )
    authUserRepo.findCredentials.mockResolvedValue({
      id: 'user-1',
      email: 'old@example.com',
      firstName: 'Pablo',
      isActive: false,
      isProtected: false,
    })

    await expect(handler.execute(command)).rejects.toThrow(/auth.account_deactivated/)
    expect(authUserRepo.applyEmailChange).not.toHaveBeenCalled()
    expect(codeRepo.consume).not.toHaveBeenCalled()
  })

  it('should reject a change_email redemption when the account became protected after the request', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(
      pendingCode({ purpose: 'change_email', targetEmail: 'new@example.com' }),
    )
    authUserRepo.findCredentials.mockResolvedValue({
      id: 'user-1',
      email: 'old@example.com',
      firstName: 'Pablo',
      isActive: true,
      isProtected: true,
    })

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_change_protected_account/)
    expect(authUserRepo.applyEmailChange).not.toHaveBeenCalled()
    expect(codeRepo.consume).not.toHaveBeenCalled()
  })

  it('should reject an unknown purpose without consuming the code as a success', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(
      pendingCode({ purpose: 'something_else' }),
    )

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_verification_invalid/)
    expect(codeRepo.consume).not.toHaveBeenCalled()
  })
})
