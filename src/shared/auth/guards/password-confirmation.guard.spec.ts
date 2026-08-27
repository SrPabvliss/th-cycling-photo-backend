import { AppException } from '@shared/domain'
import { hashSync } from 'bcryptjs'
import { PasswordConfirmationGuard } from './password-confirmation.guard'

describe('PasswordConfirmationGuard', () => {
  const passwordHash = hashSync('correct-horse', 10)
  const prisma = { user: { findUnique: jest.fn() } }

  const contextFor = (body: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ body, user: { userId: 'user-1' } }) }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    }) as never

  const reflectorReturning = (required: boolean) => ({ getAllAndOverride: () => required }) as never

  let guard: PasswordConfirmationGuard

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.user.findUnique.mockResolvedValue({ password_hash: passwordHash })
  })

  it('lets a route through untouched when it is not marked', async () => {
    guard = new PasswordConfirmationGuard(reflectorReturning(false), prisma as never)

    await expect(guard.canActivate(contextFor({}))).resolves.toBe(true)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('allows the request when the password matches', async () => {
    guard = new PasswordConfirmationGuard(reflectorReturning(true), prisma as never)

    await expect(guard.canActivate(contextFor({ password: 'correct-horse' }))).resolves.toBe(true)
  })

  it('rejects a wrong password', async () => {
    guard = new PasswordConfirmationGuard(reflectorReturning(true), prisma as never)

    await expect(guard.canActivate(contextFor({ password: 'wrong' }))).rejects.toThrow(AppException)
  })

  it('rejects a missing password', async () => {
    guard = new PasswordConfirmationGuard(reflectorReturning(true), prisma as never)

    await expect(guard.canActivate(contextFor({}))).rejects.toThrow(AppException)
  })
})
