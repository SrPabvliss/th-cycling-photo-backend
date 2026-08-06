import { PasswordResetTokenService } from './password-reset-token.service'

describe('PasswordResetTokenService', () => {
  const buildService = (secret = 'test-hmac-secret') =>
    new PasswordResetTokenService({
      getOrThrow: jest.fn().mockReturnValue(secret),
    } as never)

  it('should generate an id.secret token with 256 bits of entropy', () => {
    const { id, token, tokenHash } = buildService().generate()

    expect(token.startsWith(`${id}.`)).toBe(true)
    const secret = token.slice(id.length + 1)
    expect(Buffer.from(secret, 'base64url')).toHaveLength(32)
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(token).not.toContain(tokenHash)
  })

  it('should produce different tokens on each call', () => {
    const service = buildService()
    expect(service.generate().token).not.toBe(service.generate().token)
  })

  it('should match a secret against its own hash', () => {
    const service = buildService()
    const { token, tokenHash } = service.generate()
    const parsed = service.parse(token)

    expect(parsed).not.toBeNull()
    expect(service.matches((parsed as { secret: string }).secret, tokenHash)).toBe(true)
  })

  it('should not match a secret hashed under a different key', () => {
    const generated = buildService('secret-a').generate()
    const other = buildService('secret-b')
    const parsed = other.parse(generated.token)

    expect(other.matches((parsed as { secret: string }).secret, generated.tokenHash)).toBe(false)
  })

  it('should reject malformed tokens', () => {
    const service = buildService()

    expect(service.parse('no-separator')).toBeNull()
    expect(service.parse('')).toBeNull()
    expect(service.parse('a.b.c')).toBeNull()
    expect(service.parse('id.')).toBeNull()
    expect(service.parse('.secret')).toBeNull()
  })

  it('should return false instead of throwing on a wrong-length stored hash', () => {
    const service = buildService()
    const { token } = service.generate()
    const parsed = service.parse(token)

    expect(service.matches((parsed as { secret: string }).secret, 'short')).toBe(false)
  })
})
