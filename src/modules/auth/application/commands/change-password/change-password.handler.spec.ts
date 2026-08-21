import { compareSync, hashSync } from 'bcryptjs'
import { ChangePasswordCommand } from './change-password.command'
import { ChangePasswordHandler } from './change-password.handler'

describe('ChangePasswordHandler', () => {
  let handler: ChangePasswordHandler
  let authUserRepo: { findCredentials: jest.Mock; updatePassword: jest.Mock }
  let mailService: { enqueue: jest.Mock }
  let configService: { getOrThrow: jest.Mock }

  const validUser = () => ({
    id: 'user-1',
    email: 'user@test.com',
    firstName: 'Pablo',
    passwordHash: hashSync('CurrentPass123!', 10),
    isActive: true,
  })

  beforeEach(() => {
    authUserRepo = {
      findCredentials: jest.fn().mockResolvedValue(validUser()),
      updatePassword: jest.fn().mockResolvedValue(undefined),
    }
    mailService = { enqueue: jest.fn().mockResolvedValue(undefined) }
    configService = { getOrThrow: jest.fn().mockReturnValue('https://titantv.com.ec') }

    handler = new ChangePasswordHandler(
      authUserRepo as never,
      mailService as never,
      configService as never,
    )
  })

  const command = new ChangePasswordCommand('user-1', 'CurrentPass123!', 'BrandNewPass1!')

  it('should hash the new password and save it when the current password matches', async () => {
    await handler.execute(command)

    expect(authUserRepo.updatePassword).toHaveBeenCalledTimes(1)
    const [userId, passwordHash] = authUserRepo.updatePassword.mock.calls[0]
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

  it('should keep the change when the notice cannot be queued', async () => {
    mailService.enqueue.mockRejectedValue(new Error('redis is down'))

    await expect(handler.execute(command)).resolves.toBeUndefined()
    expect(authUserRepo.updatePassword).toHaveBeenCalledTimes(1)
  })

  it('should reject an incorrect current password without saving or emailing', async () => {
    authUserRepo.findCredentials.mockResolvedValue({
      ...validUser(),
      passwordHash: hashSync('SomeOtherPass1!', 10),
    })

    await expect(handler.execute(command)).rejects.toThrow(/auth.current_password_invalid/)
    expect(authUserRepo.updatePassword).not.toHaveBeenCalled()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('should reject a new password equal to the current one', async () => {
    const sameCommand = new ChangePasswordCommand('user-1', 'CurrentPass123!', 'CurrentPass123!')

    await expect(handler.execute(sameCommand)).rejects.toThrow(/auth.password_same_as_current/)
    expect(authUserRepo.updatePassword).not.toHaveBeenCalled()
    expect(mailService.enqueue).not.toHaveBeenCalled()
  })

  it('should reject a deactivated account', async () => {
    authUserRepo.findCredentials.mockResolvedValue({ ...validUser(), isActive: false })

    await expect(handler.execute(command)).rejects.toThrow(/auth.account_deactivated/)
    expect(authUserRepo.updatePassword).not.toHaveBeenCalled()
  })

  it('should reject an unknown user', async () => {
    authUserRepo.findCredentials.mockResolvedValue(null)

    await expect(handler.execute(command)).rejects.toThrow(/auth.invalid_credentials/)
    expect(authUserRepo.updatePassword).not.toHaveBeenCalled()
  })
})
