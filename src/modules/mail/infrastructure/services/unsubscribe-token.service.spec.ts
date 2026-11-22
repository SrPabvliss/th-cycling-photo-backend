import type { ConfigService } from '@nestjs/config'
import { UnsubscribeTokenService } from './unsubscribe-token.service'

const serviceWith = (secret: string) =>
  new UnsubscribeTokenService({ getOrThrow: () => secret } as unknown as ConfigService)

describe('UnsubscribeTokenService', () => {
  const service = serviceWith('test-secret')
  const userId = '3f0c9a52-7d0e-4c55-9c1f-1b2a3c4d5e6f'

  it('verifies its own tokens back to the user id', () => {
    expect(service.verify(service.sign(userId))).toBe(userId)
  })

  it('rejects a token for another user, a tampered one or garbage', () => {
    const [, signature] = service.sign(userId).split('.')
    const forged = `${Buffer.from('another-user').toString('base64url')}.${signature}`
    expect(service.verify(forged)).toBeNull()
    expect(service.verify(`${service.sign(userId)}x`)).toBeNull()
    expect(service.verify('not-a-token')).toBeNull()
    expect(service.verify('')).toBeNull()
  })

  it('rejects tokens signed with another secret', () => {
    expect(serviceWith('other-secret').verify(service.sign(userId))).toBeNull()
  })
})
