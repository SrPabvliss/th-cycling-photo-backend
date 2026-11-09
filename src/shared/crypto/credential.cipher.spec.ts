import { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain'
import { CredentialCipher } from './credential.cipher'

const KEY_HEX = 'a'.repeat(64)

function makeCipher(): CredentialCipher {
  const config = { getOrThrow: () => KEY_HEX } as unknown as ConfigService
  return new CredentialCipher(config)
}

describe('CredentialCipher', () => {
  it('returns the original value after a round trip', () => {
    const cipher = makeCipher()
    expect(cipher.decrypt(cipher.encrypt('secret-token'))).toBe('secret-token')
  })

  it('produces a different ciphertext each time', () => {
    const cipher = makeCipher()
    expect(cipher.encrypt('secret-token')).not.toBe(cipher.encrypt('secret-token'))
  })

  it('stores three colon separated parts', () => {
    const cipher = makeCipher()
    expect(cipher.encrypt('secret-token').split(':')).toHaveLength(3)
  })

  it('rejects a tampered payload', () => {
    const cipher = makeCipher()
    const [iv, tag, data] = cipher.encrypt('secret-token').split(':')
    expect(() => cipher.decrypt(`${iv}:${tag}:${data.slice(0, -2)}ff`)).toThrow()
  })

  it('rejects a key that is not 32 bytes', () => {
    const config = { getOrThrow: () => 'abcd' } as unknown as ConfigService
    expect(() => new CredentialCipher(config)).toThrow('CREDENTIAL_ENCRYPTION_KEY')
  })

  it('raises an application error for a malformed payload', () => {
    const cipher = makeCipher()
    expect(() => cipher.decrypt('not-a-valid-payload')).toThrow(AppException)
  })
})
