import { RequestPasswordResetCommand } from './request-password-reset.command'
import { RequestPasswordResetHandler } from './request-password-reset.handler'

describe('RequestPasswordResetHandler', () => {
  let handler: RequestPasswordResetHandler
  let authUserRepo: { findForPasswordReset: jest.Mock }
  let tokenRepo: {
    create: jest.Mock
    findLastCreatedAtForUser: jest.Mock
    findById: jest.Mock
    consumeAndUpdatePassword: jest.Mock
  }
  let tokenService: { generate: jest.Mock; parse: jest.Mock; matches: jest.Mock }
  let mailService: { enqueue: jest.Mock }
  let configService: { getOrThrow: jest.Mock; get: jest.Mock }

  beforeEach(() => {
    authUserRepo = { findForPasswordReset: jest.fn() }
    tokenRepo = {
      create: jest.fn().mockResolvedValue(undefined),
      findLastCreatedAtForUser: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      consumeAndUpdatePassword: jest.fn(),
    }
    tokenService = {
      generate: jest
        .fn()
        .mockReturnValue({ id: 'token-id', token: 'token-id.secret', tokenHash: 'hashed' }),
      parse: jest.fn(),
      matches: jest.fn(),
    }
    mailService = { enqueue: jest.fn().mockResolvedValue(undefined) }
    configService = {
      getOrThrow: jest.fn((key: string) =>
        key === 'app.webBaseUrl' ? 'https://titantv.com.ec' : undefined,
      ),
      get: jest.fn((_key: string, fallback?: unknown) => fallback),
    }

    handler = new RequestPasswordResetHandler(
      authUserRepo as never,
      tokenRepo as never,
      tokenService as never,
      mailService as never,
      configService as never,
    )
  })

  const command = new RequestPasswordResetCommand('user@test.com', '1.2.3.4', 'jest')

  it('should store a hashed token and enqueue a fragment link', async () => {
    authUserRepo.findForPasswordReset.mockResolvedValue({
      id: 'user-1',
      firstName: 'Pablo',
      isActive: true,
    })

    await handler.execute(command)

    expect(tokenRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'token-id', userId: 'user-1', tokenHash: 'hashed' }),
    )
    const stored = tokenRepo.create.mock.calls[0][0]
    expect(stored.tokenHash).not.toBe('token-id.secret')
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now())

    expect(mailService.enqueue).toHaveBeenCalledTimes(1)
    const job = mailService.enqueue.mock.calls[0][0]
    expect(job.to).toBe('user@test.com')
    expect(job.template).toBe('password-reset')
    expect(job.subject).toBe('Restablece tu contraseña — vence en 30 minutos')
    expect(job.vars.resetUrl).toBe('https://titantv.com.ec/reset-password#t=token-id.secret')
    expect(job.vars.logoUrl).toBe('https://titantv.com.ec/brand/logo-email.png')
    expect(job.vars.firstName).toBe('Pablo')
  })

  it('should stay silent for an unknown email', async () => {
    authUserRepo.findForPasswordReset.mockResolvedValue(null)

    await expect(handler.execute(command)).resolves.toBeUndefined()
    expect(tokenRepo.create).not.toHaveBeenCalled()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('should stay silent for a deactivated account', async () => {
    authUserRepo.findForPasswordReset.mockResolvedValue({
      id: 'user-2',
      firstName: 'Ana',
      isActive: false,
    })

    await expect(handler.execute(command)).resolves.toBeUndefined()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('should not send a second email within 60 seconds', async () => {
    authUserRepo.findForPasswordReset.mockResolvedValue({
      id: 'user-1',
      firstName: 'Pablo',
      isActive: true,
    })
    tokenRepo.findLastCreatedAtForUser.mockResolvedValue(new Date(Date.now() - 10_000))

    await handler.execute(command)

    expect(tokenRepo.create).not.toHaveBeenCalled()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('should send again once the cooldown has passed', async () => {
    authUserRepo.findForPasswordReset.mockResolvedValue({
      id: 'user-1',
      firstName: 'Pablo',
      isActive: true,
    })
    tokenRepo.findLastCreatedAtForUser.mockResolvedValue(new Date(Date.now() - 120_000))

    await handler.execute(command)

    expect(mailService.enqueue).toHaveBeenCalledTimes(1)
  })

  it('should use a neutral greeting when the user has no first name', async () => {
    authUserRepo.findForPasswordReset.mockResolvedValue({
      id: 'user-3',
      firstName: null,
      isActive: true,
    })

    await handler.execute(command)

    expect(mailService.enqueue.mock.calls[0][0].vars.firstName).toBe('ciclista')
  })
})
