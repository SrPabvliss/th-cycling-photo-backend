import { isSafeStorageKey } from './storage-key'

describe('isSafeStorageKey', () => {
  it('rejects a key with a traversal segment that escapes its prefix', () => {
    expect(isSafeStorageKey('tenants/a/watermark/../../b/photos/secret.jpg')).toBe(false)
  })

  it('accepts a legitimate tenant watermark key', () => {
    expect(isSafeStorageKey('tenants/a/watermark/uuid-logo.png')).toBe(true)
  })
})
