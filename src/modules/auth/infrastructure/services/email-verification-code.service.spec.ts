import { EmailVerificationCodeService } from './email-verification-code.service'

describe('EmailVerificationCodeService', () => {
  const buildService = (secret = 'test-hmac-secret') =>
    new EmailVerificationCodeService({
      getOrThrow: jest.fn().mockReturnValue(secret),
    } as never)

  it('should generate a 6-digit zero-padded code with its hash', () => {
    const { code, hash } = buildService().generate()

    expect(code).toMatch(/^\d{6}$/)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('should produce different codes across calls', () => {
    const service = buildService()
    const codes = Array.from({ length: 20 }, () => service.generate().code)

    expect(new Set(codes).size).toBeGreaterThan(1)
  })

  it('should match a code against its own hash', () => {
    const service = buildService()
    const { code, hash } = service.generate()

    expect(service.matches(code, hash)).toBe(true)
  })

  it('should not match a code hashed under a different secret', () => {
    const generated = buildService('secret-a').generate()
    const other = buildService('secret-b')

    expect(other.matches(generated.code, generated.hash)).toBe(false)
  })

  it('should not match a wrong code', () => {
    const service = buildService()
    const { code, hash } = service.generate()
    const wrongCode = code === '000000' ? '111111' : '000000'

    expect(service.matches(wrongCode, hash)).toBe(false)
  })

  it('should return false instead of throwing on a wrong-length stored hash', () => {
    const service = buildService()
    const { code } = service.generate()

    expect(service.matches(code, 'short')).toBe(false)
  })
})
