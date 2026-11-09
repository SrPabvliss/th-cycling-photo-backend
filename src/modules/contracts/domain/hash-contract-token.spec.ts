import { hashContractToken } from './hash-contract-token'

describe('hashContractToken', () => {
  it('produces a deterministic 64-character hex digest', () => {
    const hash = hashContractToken('the-plaintext-token')

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashContractToken('the-plaintext-token')).toBe(hash)
  })

  it('produces different digests for different tokens', () => {
    expect(hashContractToken('token-a')).not.toBe(hashContractToken('token-b'))
  })
})
