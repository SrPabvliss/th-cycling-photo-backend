import { EmailVerificationSendGuard } from '../../services'
import { SendEmailVerificationCommand } from './send-email-verification.command'
import { SendEmailVerificationHandler } from './send-email-verification.handler'

describe('SendEmailVerificationHandler', () => {
  let handler: SendEmailVerificationHandler
  let authUserRepo: { findCredentials: jest.Mock }
  let codeRepo: { create: jest.Mock; countSentSince: jest.Mock }
  let codeService: { generate: jest.Mock }
  let sendGuard: { assertCanSend: jest.Mock }
  let mailService: { enqueue: jest.Mock }
  let configService: { getOrThrow: jest.Mock }

  const validUser = () => ({
    id: 'user-1',
    email: 'rider@example.com',
    firstName: 'Pablo',
    isActive: true,
  })

  beforeEach(() => {
    authUserRepo = { findCredentials: jest.fn().mockResolvedValue(validUser()) }
    codeRepo = {
      create: jest.fn().mockResolvedValue(undefined),
      countSentSince: jest.fn().mockResolvedValue(0),
    }
    codeService = {
      generate: jest.fn().mockReturnValue({ code: '482913', hash: 'hashed-code' }),
    }
    mailService = { enqueue: jest.fn().mockResolvedValue(undefined) }
    configService = { getOrThrow: jest.fn().mockReturnValue('https://titantv.com.ec') }
    sendGuard = new EmailVerificationSendGuard(codeRepo as never) as never

    handler = new SendEmailVerificationHandler(
      authUserRepo as never,
      codeRepo as never,
      codeService as never,
      sendGuard as never,
      mailService as never,
      configService as never,
    )
  })

  const command = new SendEmailVerificationCommand('user-1')

  it('should store the code hash and enqueue the email with the plaintext code', async () => {
    await handler.execute(command)

    expect(codeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        purpose: 'verify_current',
        targetEmail: 'rider@example.com',
        codeHash: 'hashed-code',
      }),
    )
    const stored = codeRepo.create.mock.calls[0][0]
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now())

    expect(mailService.enqueue).toHaveBeenCalledTimes(1)
    const job = mailService.enqueue.mock.calls[0][0]
    expect(job.to).toBe('rider@example.com')
    expect(job.template).toBe('email-verification-code')
    expect(job.vars.code).toBe('482913')
    expect(job.vars.firstName).toBe('Pablo')
  })

  it('should reject sending again within the 60-second cooldown', async () => {
    codeRepo.countSentSince.mockResolvedValueOnce(1)

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_verification_cooldown/)
    expect(codeRepo.create).not.toHaveBeenCalled()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('should reject once the daily send limit is reached', async () => {
    codeRepo.countSentSince.mockResolvedValueOnce(0).mockResolvedValueOnce(10)

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_verification_daily_limit/)
    expect(codeRepo.create).not.toHaveBeenCalled()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('should let a failing mail queue error surface instead of swallowing it', async () => {
    mailService.enqueue.mockRejectedValue(new Error('redis is down'))

    await expect(handler.execute(command)).rejects.toThrow('redis is down')
    expect(codeRepo.create).toHaveBeenCalledTimes(1)
  })

  it('should reject a deactivated account', async () => {
    authUserRepo.findCredentials.mockResolvedValue({ ...validUser(), isActive: false })

    await expect(handler.execute(command)).rejects.toThrow(/auth.account_deactivated/)
    expect(codeRepo.create).not.toHaveBeenCalled()
  })

  it('should reject an unknown user', async () => {
    authUserRepo.findCredentials.mockResolvedValue(null)

    await expect(handler.execute(command)).rejects.toThrow(/auth.invalid_credentials/)
    expect(codeRepo.create).not.toHaveBeenCalled()
  })
})
