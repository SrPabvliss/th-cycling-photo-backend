import { PayphoneTransferToCipher } from './payphone-transfer-to.cipher'

function buildCipher(password = 'your-coding-password'): PayphoneTransferToCipher {
  const config = { getOrThrow: jest.fn().mockReturnValue(password) }
  return new PayphoneTransferToCipher(config as never)
}

describe('PayphoneTransferToCipher', () => {
  it('produces base64 output', () => {
    const encrypted = buildCipher().encrypt('[]')

    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('is deterministic, which is the documented behaviour', () => {
    const cipher = buildCipher()

    expect(cipher.encrypt('same')).toBe(cipher.encrypt('same'))
  })

  it('produces different output for different input', () => {
    const cipher = buildCipher()

    expect(cipher.encrypt('a')).not.toBe(cipher.encrypt('b'))
  })

  it('pads a short password to 32 bytes rather than dropping the key size', () => {
    expect(() => buildCipher('short').encrypt('value')).not.toThrow()
  })

  it('refuses a password longer than 32 bytes instead of truncating it', () => {
    expect(() => buildCipher('x'.repeat(33))).toThrow(/32/)
  })

  it('round-trips through the matching decrypt helper', () => {
    const cipher = buildCipher()
    const payload = JSON.stringify([{ Identifier: '+593984112233', Type: 4, Amount: 1885 }])

    expect(cipher.decryptForTesting(cipher.encrypt(payload))).toBe(payload)
  })
})
