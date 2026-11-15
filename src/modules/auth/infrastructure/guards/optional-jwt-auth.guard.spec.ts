import type { ExecutionContext } from '@nestjs/common'
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard'

describe('OptionalJwtAuthGuard', () => {
  const contextWith = (authorization?: unknown) => {
    const request = { headers: authorization === undefined ? {} : { authorization } }
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext
  }

  /** Stands in for the passport flow, which is the same one protected routes go through. */
  const guardWithSession = (outcome: 'accepts' | 'rejects') => {
    const guard = new OptionalJwtAuthGuard()
    const verifySession = jest.spyOn(guard, 'verifySession').mockImplementation(async () => {
      if (outcome === 'rejects') throw new Error('Unauthorized')
      return true
    })
    return { guard, verifySession }
  }

  it('lets a request without an Authorization header through as anonymous, verifying nothing', async () => {
    const { guard, verifySession } = guardWithSession('rejects')

    await expect(guard.canActivate(contextWith())).resolves.toBe(true)
    expect(verifySession).not.toHaveBeenCalled()
  })

  it.each([
    ['an empty header', ''],
    ['a blank header', '   '],
  ])('treats %s as no header at all', async (_case, authorization) => {
    const { guard, verifySession } = guardWithSession('rejects')

    await expect(guard.canActivate(contextWith(authorization))).resolves.toBe(true)
    expect(verifySession).not.toHaveBeenCalled()
  })

  it('verifies the session whenever a header is present, and passes when it holds', async () => {
    const { guard, verifySession } = guardWithSession('accepts')
    const context = contextWith('Bearer a.valid.token')

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(verifySession).toHaveBeenCalledWith(context)
  })

  it.each([
    ['an expired or invalid token', 'Bearer expired.or.invalid'],
    ['text that is not a token', 'Bearer not-a-jwt'],
    ['a Bearer scheme with no token', 'Bearer'],
    ['a Bearer scheme followed only by a space', 'Bearer '],
    ['another scheme', 'Basic dXNlcjpwYXNz'],
  ])('never falls back to anonymous for %s: the rejection is passed on', async (_case, authorization) => {
    const { guard, verifySession } = guardWithSession('rejects')

    await expect(guard.canActivate(contextWith(authorization))).rejects.toThrow('Unauthorized')
    expect(verifySession).toHaveBeenCalledTimes(1)
  })
})
