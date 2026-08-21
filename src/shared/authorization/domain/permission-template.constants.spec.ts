import { ALL_PERMISSION_KEYS, PERMISSIONS } from './permission-catalog'
import {
  ADMIN_EXCLUDED,
  TEMPLATE_KEYS,
  TEMPLATE_PERMISSIONS,
} from './permission-template.constants'

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

  it('gives platform_admin every administrative permission — the catalog minus the operator-own-scope exclusion', () => {
    // platform_admin is deliberately not literally every catalog key — see `ADMIN_EXCLUDED`.
    // Keep this an exact equality, not a subset check, or a future narrowing that accidentally
    // drops an administrative permission would pass silently.
    const expected = ALL_PERMISSION_KEYS.filter((k) => !ADMIN_EXCLUDED.includes(k))
    expect([...TEMPLATE_PERMISSIONS[TEMPLATE_KEYS.PLATFORM_ADMIN]].sort()).toEqual(expected.sort())
  })

  it('excludes exactly the one deliberate key from platform_admin, no more and no fewer', () => {
    expect([...ADMIN_EXCLUDED].sort()).toEqual(['dashboard.operator.read'])
  })

  it('holds every OTHER platform-only permission despite the narrowing', () => {
    // dashboard.operator.read is the one platform-only key the exclusion removes, deliberately.
    const platformOnlyKeys = ALL_PERMISSION_KEYS.filter((k) => PERMISSIONS[k].platformOnly)
    const missingFromAdmin = platformOnlyKeys.filter(
      (k) => !TEMPLATE_PERMISSIONS[TEMPLATE_KEYS.PLATFORM_ADMIN].includes(k),
    )
    expect(missingFromAdmin).toEqual(['dashboard.operator.read'])
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
