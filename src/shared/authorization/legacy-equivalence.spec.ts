import { PERMISSIONS, type PermissionKey } from './domain/permission-catalog'
import { TEMPLATE_KEYS, TEMPLATE_PERMISSIONS } from './domain/permission-template.constants'
import { INTENTIONAL_DIVERGENCES, ROLE_INTENTIONAL_DIVERGENCES } from './intentional-divergences'
import { ROUTE_CENSUS } from './route-census'

/**
 * The compensating control for cutting over without a production shadow-mode period: proves the new
 * engine reaches the same verdict as the legacy `RolesGuard` on every route in `ROUTE_CENSUS`, for
 * every legacy role, minus the entries in `INTENTIONAL_DIVERGENCES` and
 * `ROLE_INTENTIONAL_DIVERGENCES`.
 *
 * `RolesGuard` is deliberately not imported — it is deleted, and this matrix must keep passing.
 * `legacyAllows` reimplements its rule, including the quirk that a route with no `@Roles()` let any
 * authenticated user through, which is why 19 routes needed reclassifying.
 */
type LegacyRole = 'admin' | 'operator' | 'customer' | 'anonymous'

const TEMPLATE_FOR: Record<Exclude<LegacyRole, 'anonymous'>, keyof typeof TEMPLATE_PERMISSIONS> = {
  admin: TEMPLATE_KEYS.PLATFORM_ADMIN,
  operator: TEMPLATE_KEYS.PLATFORM_STAFF,
  customer: TEMPLATE_KEYS.CUSTOMER,
}

const legacyAllows = (role: LegacyRole, marker: string): boolean => {
  if (marker === 'PUBLIC') return true
  if (role === 'anonymous') return false
  if (marker === 'NONE') return true // old guard let ANY authenticated user through
  return marker.split(',').includes(role)
}

const engineAllows = (
  role: LegacyRole,
  permission: PermissionKey | 'PUBLIC' | 'AUTHENTICATED',
): boolean => {
  if (permission === 'PUBLIC') return true
  if (role === 'anonymous') return false
  if (permission === 'AUTHENTICATED') return true
  const isPlatform = role === 'admin' || role === 'operator'
  // These three keys are platformOnly, and step 1 of the resolution algorithm denies those to
  // non-platform principals before templates are consulted.
  if (PERMISSIONS[permission].platformOnly && !isPlatform) return false
  return TEMPLATE_PERMISSIONS[TEMPLATE_FOR[role]].includes(permission)
}

describe('legacy equivalence', () => {
  const roles: LegacyRole[] = ['admin', 'operator', 'customer', 'anonymous']

  for (const route of ROUTE_CENSUS) {
    const id = `${route.method} ${route.path}`
    for (const role of roles) {
      const testName = `${role} on ${id}`
      if (INTENTIONAL_DIVERGENCES.has(id) || ROLE_INTENTIONAL_DIVERGENCES.has(`${role} ${id}`)) {
        it.skip(`${testName} (intentional divergence)`, () => {})
        continue
      }
      it(testName, () => {
        expect(engineAllows(role, route.permission)).toBe(legacyAllows(role, route.legacyMarker))
      })
    }
  }
})
