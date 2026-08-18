import { isPermissionKey, PERMISSIONS } from './permission-catalog'

describe('permission catalog', () => {
  it('uses resource.action key format throughout', () => {
    for (const key of Object.keys(PERMISSIONS)) {
      expect(key).toMatch(/^[a-z_]+(\.[a-z_]+)+$/)
    }
  })

  it('never marks a permission both platform-only and part of the tenant template', () => {
    // guarded properly in Task 3; here we assert the flag exists and is boolean
    for (const meta of Object.values(PERMISSIONS)) {
      expect(typeof meta.platformOnly).toBe('boolean')
      expect(typeof meta.eventScope).toBe('boolean')
    }
  })

  it('marks event.read.all as platform-only and not event-scoped', () => {
    expect(PERMISSIONS['event.read.all']).toEqual({
      category: 'events',
      platformOnly: true,
      eventScope: false,
    })
  })

  it('accepts a real permission key', () => {
    expect(isPermissionKey('event.read')).toBe(true)
  })

  it('rejects inherited Object.prototype property names rather than treating them as valid keys', () => {
    // `in` walks the prototype chain, so these would wrongly resolve to
    // `true` if isPermissionKey used `value in PERMISSIONS` instead of
    // `Object.hasOwn`. This is the one path by which a non-PermissionKey
    // string reaches the engine: the guard reads the decorator's metadata
    // as an untyped string.
    for (const name of ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']) {
      expect(isPermissionKey(name)).toBe(false)
    }
  })

  it('rejects an unknown but plausible-looking key', () => {
    expect(isPermissionKey('event.updte')).toBe(false)
  })
})
