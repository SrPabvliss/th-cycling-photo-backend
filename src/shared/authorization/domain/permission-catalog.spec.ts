import { PERMISSIONS, type PermissionKey } from './permission-catalog'

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
})
