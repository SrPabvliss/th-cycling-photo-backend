import { UnauthorizedException } from '@nestjs/common'
import { JwtStrategy } from './jwt.strategy'

describe('JwtStrategy', () => {
  const config = { getOrThrow: jest.fn().mockReturnValue('secret') }
  const build = (session: { isActive: boolean; version: number } | null) => {
    const authUserRepo = { findSessionVersion: jest.fn().mockResolvedValue(session) }
    return new JwtStrategy(config as never, authUserRepo as never)
  }
  const payload = { sub: 'u1', email: 'a@b.c', role: 'customer', pv: 3 }

  it('accepts a token issued for the current session version', async () => {
    await expect(build({ isActive: true, version: 3 }).validate(payload)).resolves.toEqual({
      userId: 'u1',
      email: 'a@b.c',
      role: 'customer',
    })
  })

  it('rejects a token issued before a password change or logout', async () => {
    await expect(build({ isActive: true, version: 4 }).validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('rejects a token without a version', async () => {
    const { pv: _, ...legacy } = payload
    await expect(build({ isActive: true, version: 0 }).validate(legacy)).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('rejects a deactivated or deleted user', async () => {
    await expect(build({ isActive: false, version: 3 }).validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
    await expect(build(null).validate(payload)).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
