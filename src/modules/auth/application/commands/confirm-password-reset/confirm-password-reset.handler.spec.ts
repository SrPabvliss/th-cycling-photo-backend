import { compareSync } from 'bcryptjs'
import { ConfirmPasswordResetCommand } from './confirm-password-reset.command'
import { ConfirmPasswordResetHandler } from './confirm-password-reset.handler'

describe('ConfirmPasswordResetHandler', () => {
  let handler: ConfirmPasswordResetHandler
  let tokenRepo: {
    findById: jest.Mock
    consumeAndUpdatePassword: jest.Mock
    create: jest.Mock
    findLastCreatedAtForUser: jest.Mock
  }
  let tokenService: { parse: jest.Mock; matches: jest.Mock; generate: jest.Mock }
  let mailService: { enqueue: jest.Mock }
  let configService: { getOrThrow: jest.Mock }

  const validRow = () => ({
    id: 'token-id',
    userId: 'user-1',
    tokenHash: 'hashed',
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    isActive: true,
    email: 'user@test.com',
    firstName: 'Pablo',
  })

  beforeEach(() => {
    tokenRepo = {
      findById: jest.fn().mockResolvedValue(validRow()),
      consumeAndUpdatePassword: jest.fn().mockResolvedValue(true),
      create: jest.fn(),
      findLastCreatedAtForUser: jest.fn(),
    }
    tokenService = {
      parse: jest.fn().mockReturnValue({ id: 'token-id', secret: 'secret' }),
      matches: jest.fn().mockReturnValue(true),
      generate: jest.fn(),
    }
    mailService = { enqueue: jest.fn().mockResolvedValue(undefined) }
    configService = { getOrThrow: jest.fn().mockReturnValue('https://titantv.com.ec') }

    handler = new ConfirmPasswordResetHandler(
      tokenRepo as never,
      tokenService as never,
      mailService as never,
      configService as never,
    )
  })

  const command = new ConfirmPasswordResetCommand('token-id.secret', 'BrandNewPass1!')

  it('should hash the new password with bcrypt and consume the token', async () => {
    await handler.execute(command)

    expect(tokenRepo.consumeAndUpdatePassword).toHaveBeenCalledTimes(1)
    const [tokenId, userId, passwordHash] = tokenRepo.consumeAndUpdatePassword.mock.calls[0]
    expect(tokenId).toBe('token-id')
    expect(userId).toBe('user-1')
    expect(passwordHash).not.toBe('BrandNewPass1!')
    expect(compareSync('BrandNewPass1!', passwordHash)).toBe(true)
  })

  it('should enqueue the password-changed notice', async () => {
    await handler.execute(command)

    const job = mailService.enqueue.mock.calls[0][0]
    expect(job.to).toBe('user@test.com')
    expect(job.template).toBe('password-changed')
    expect(job.vars.firstName).toBe('Pablo')
    expect(job.vars.logoUrl).toBe('https://titantv.com.ec/brand/logo-email.png')
    expect(job.vars.changedTime).toMatch(/^\d{2}:\d{2}$/)
    expect(job.vars.changedDate).toEqual(expect.any(String))
    expect(job.subject).toBe(
      `Tu contraseña cambió — ${job.vars.changedDate}, ${job.vars.changedTime}`,
    )
  })

  it('should reject a malformed token', async () => {
    tokenService.parse.mockReturnValue(null)

    await expect(handler.execute(command)).rejects.toThrow('auth.reset_token_invalid')
    expect(tokenRepo.consumeAndUpdatePassword).not.toHaveBeenCalled()
  })

  it('should reject an unknown token id', async () => {
    tokenRepo.findById.mockResolvedValue(null)

    await expect(handler.execute(command)).rejects.toThrow('auth.reset_token_invalid')
  })

  it('should reject a secret that does not match the stored hash', async () => {
    tokenService.matches.mockReturnValue(false)

    await expect(handler.execute(command)).rejects.toThrow('auth.reset_token_invalid')
    expect(tokenRepo.consumeAndUpdatePassword).not.toHaveBeenCalled()
  })

  it('should reject an expired token', async () => {
    tokenRepo.findById.mockResolvedValue({
      ...validRow(),
      expiresAt: new Date(Date.now() - 1000),
    })

    await expect(handler.execute(command)).rejects.toThrow('auth.reset_token_expired')
  })

  it('should reject an already-used token', async () => {
    tokenRepo.findById.mockResolvedValue({ ...validRow(), usedAt: new Date() })

    await expect(handler.execute(command)).rejects.toThrow('auth.reset_token_used')
  })

  it('should reject a token whose account was deactivated after the request', async () => {
    tokenRepo.findById.mockResolvedValue({ ...validRow(), isActive: false })

    await expect(handler.execute(command)).rejects.toThrow('auth.account_deactivated')
  })

  it('should reject a lost redemption race without sending the confirmation email', async () => {
    tokenRepo.consumeAndUpdatePassword.mockResolvedValue(false)

    await expect(handler.execute(command)).rejects.toThrow('auth.reset_token_used')
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })
})
