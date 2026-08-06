import { ValidatePasswordResetTokenCommand } from './validate-password-reset-token.command'
import { ValidatePasswordResetTokenHandler } from './validate-password-reset-token.handler'

describe('ValidatePasswordResetTokenHandler', () => {
  let handler: ValidatePasswordResetTokenHandler
  let tokenRepo: { findById: jest.Mock }
  let tokenService: { parse: jest.Mock; matches: jest.Mock }

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
    tokenRepo = { findById: jest.fn().mockResolvedValue(validRow()) }
    tokenService = {
      parse: jest.fn().mockReturnValue({ id: 'token-id', secret: 'secret' }),
      matches: jest.fn().mockReturnValue(true),
    }
    handler = new ValidatePasswordResetTokenHandler(tokenRepo as never, tokenService as never)
  })

  const command = new ValidatePasswordResetTokenCommand('token-id.secret')

  it('should report a live token as valid', async () => {
    await expect(handler.execute(command)).resolves.toEqual({ valid: true })
  })

  it('should report an expired token as invalid without throwing', async () => {
    tokenRepo.findById.mockResolvedValue({ ...validRow(), expiresAt: new Date(Date.now() - 1000) })

    await expect(handler.execute(command)).resolves.toEqual({ valid: false })
  })

  it('should report a used token as invalid', async () => {
    tokenRepo.findById.mockResolvedValue({ ...validRow(), usedAt: new Date() })

    await expect(handler.execute(command)).resolves.toEqual({ valid: false })
  })

  it('should report a malformed token as invalid', async () => {
    tokenService.parse.mockReturnValue(null)

    await expect(handler.execute(command)).resolves.toEqual({ valid: false })
  })

  it('should report a mismatched secret as invalid', async () => {
    tokenService.matches.mockReturnValue(false)

    await expect(handler.execute(command)).resolves.toEqual({ valid: false })
  })
})
