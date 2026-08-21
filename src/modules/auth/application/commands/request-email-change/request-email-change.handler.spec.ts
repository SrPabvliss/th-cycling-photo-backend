import { hashSync } from 'bcryptjs'
import { EmailVerificationSendGuard } from '../../services'
import { RequestEmailChangeCommand } from './request-email-change.command'
import { RequestEmailChangeHandler } from './request-email-change.handler'

describe('RequestEmailChangeHandler', () => {
  let handler: RequestEmailChangeHandler
  let authUserRepo: { findCredentials: jest.Mock; findByEmailExists: jest.Mock }
  let codeRepo: { create: jest.Mock; countSentSince: jest.Mock }
  let codeService: { generate: jest.Mock }
  let sendGuard: EmailVerificationSendGuard
  let mailService: { enqueue: jest.Mock }
  let configService: { getOrThrow: jest.Mock }

  const validUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'user-1',
    email: 'rider@example.com',
    firstName: 'Pablo',
    passwordHash: hashSync('CurrentPass123!', 10),
    isActive: true,
    isProtected: false,
    ...overrides,
  })

  beforeEach(() => {
    authUserRepo = {
      findCredentials: jest.fn().mockResolvedValue(validUser()),
      findByEmailExists: jest.fn().mockResolvedValue(false),
    }
    codeRepo = {
      create: jest.fn().mockResolvedValue(undefined),
      countSentSince: jest.fn().mockResolvedValue(0),
    }
    codeService = {
      generate: jest.fn().mockReturnValue({ code: '482913', hash: 'hashed-code' }),
    }
    mailService = { enqueue: jest.fn().mockResolvedValue(undefined) }
    configService = { getOrThrow: jest.fn().mockReturnValue('https://titantv.com.ec') }
    sendGuard = new EmailVerificationSendGuard(codeRepo as never)

    handler = new RequestEmailChangeHandler(
      authUserRepo as never,
      codeRepo as never,
      codeService as never,
      sendGuard,
      mailService as never,
      configService as never,
    )
  })

  const command = new RequestEmailChangeCommand(
    'user-1',
    'New-Address@Example.com',
    'CurrentPass123!',
  )

  it('should store the code with change_email purpose and the new target, and email the new address', async () => {
    await handler.execute(command)

    expect(codeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        purpose: 'change_email',
        targetEmail: 'New-Address@Example.com',
        codeHash: 'hashed-code',
      }),
    )

    expect(mailService.enqueue).toHaveBeenCalledTimes(1)
    const job = mailService.enqueue.mock.calls[0][0]
    expect(job.to).toBe('New-Address@Example.com')
    expect(job.template).toBe('email-verification-code')
    expect(job.vars.code).toBe('482913')
  })

  it('should preserve the capitalization the person typed, without lowercasing it', async () => {
    const mixedCaseCommand = new RequestEmailChangeCommand(
      'user-1',
      '  Ana.Perez@Gmail.com  ',
      'CurrentPass123!',
    )

    await handler.execute(mixedCaseCommand)

    expect(codeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ targetEmail: 'Ana.Perez@Gmail.com' }),
    )
    expect(mailService.enqueue.mock.calls[0][0].to).toBe('Ana.Perez@Gmail.com')
  })

  it('should reject an incorrect current password without storing anything', async () => {
    authUserRepo.findCredentials.mockResolvedValue({
      ...validUser(),
      passwordHash: hashSync('SomeOtherPass1!', 10),
    })

    await expect(handler.execute(command)).rejects.toThrow(/auth.current_password_invalid/)
    expect(codeRepo.create).not.toHaveBeenCalled()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('should reject when the new address already belongs to another account', async () => {
    authUserRepo.findByEmailExists.mockResolvedValue(true)

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_change_target_taken/)
    expect(codeRepo.create).not.toHaveBeenCalled()
  })

  it('should reject a protected account', async () => {
    authUserRepo.findCredentials.mockResolvedValue(validUser({ isProtected: true }))

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_change_protected_account/)
    expect(codeRepo.create).not.toHaveBeenCalled()
  })

  it('should reject a new address equal to the current one after trimming whitespace', async () => {
    const sameEmailCommand = new RequestEmailChangeCommand(
      'user-1',
      '  rider@example.com  ',
      'CurrentPass123!',
    )

    await expect(handler.execute(sameEmailCommand)).rejects.toThrow(
      /auth.email_change_same_as_current/,
    )
    expect(codeRepo.create).not.toHaveBeenCalled()
  })

  it('should respect the resend cooldown', async () => {
    codeRepo.countSentSince.mockResolvedValueOnce(1)

    await expect(handler.execute(command)).rejects.toThrow(/auth.email_verification_cooldown/)
    expect(codeRepo.create).not.toHaveBeenCalled()
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
