import { PERMISSIONS } from './permission-catalog'
import { TEMPLATE_KEYS, TEMPLATE_PERMISSIONS } from './permission-template.constants'

describe('permission templates', () => {
  it('never grants a platform-only permission to the tenant template', () => {
    const leaked = TEMPLATE_PERMISSIONS[TEMPLATE_KEYS.TENANT].filter(
      (k) => PERMISSIONS[k].platformOnly,
    )
    expect(leaked).toEqual([])
  })

  it('never grants a platform-only permission to the customer template', () => {
    const leaked = TEMPLATE_PERMISSIONS[TEMPLATE_KEYS.CUSTOMER].filter(
      (k) => PERMISSIONS[k].platformOnly,
    )
    expect(leaked).toEqual([])
  })

  it('gives platform_admin every permission in the catalog', () => {
    expect([...TEMPLATE_PERMISSIONS[TEMPLATE_KEYS.PLATFORM_ADMIN]].sort()).toEqual(
      Object.keys(PERMISSIONS).sort(),
    )
  })

  it('withholds event.read.all from platform_staff so restricted staff stay scoped', () => {
    expect(TEMPLATE_PERMISSIONS[TEMPLATE_KEYS.PLATFORM_STAFF]).not.toContain('event.read.all')
  })

  it('withholds buyer.read and order.gift from platform_staff', () => {
    const staff = TEMPLATE_PERMISSIONS[TEMPLATE_KEYS.PLATFORM_STAFF]
    expect(staff).not.toContain('buyer.read')
    expect(staff).not.toContain('order.gift')
  })
})
