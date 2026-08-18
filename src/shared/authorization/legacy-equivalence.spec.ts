import { PERMISSIONS, type PermissionKey } from './domain/permission-catalog'
import { TEMPLATE_KEYS, TEMPLATE_PERMISSIONS } from './domain/permission-template.constants'
import { INTENTIONAL_DIVERGENCES } from './intentional-divergences'
import { ROUTE_CENSUS } from './route-census'

/**
 * The compensating control for cutting TIT-38 over without a production
 * shadow-mode period (design spec §10, D9). It proves the new permission
 * engine reaches the same allow/deny verdict as the legacy `RolesGuard` on
 * every route in `ROUTE_CENSUS`, for every legacy role, except the 18 routes
 * in `INTENTIONAL_DIVERGENCES` whose behaviour changes on purpose.
 *
 * `RolesGuard` itself is deliberately NOT imported — Task 15 deletes it, and
 * this matrix must keep passing afterwards. `legacyAllows` below is a literal
 * reimplementation of its rule (see src/shared/auth/guards/roles.guard.ts):
 * `requiredRoles.includes(user.role)`, with the historical quirk that a route
 * carrying no `@Roles()` at all (legacy marker 'NONE') let ANY authenticated
 * user through — that quirk is exactly why 19 routes needed reclassifying.
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
  // Ruling 22: dashboard.operator.read, dashboard.review_queue.read and
  // photo.retouch.read are platformOnly. Step 1 of the resolution algorithm
  // (design spec §6) denies platformOnly permissions to non-platform
  // principals before templates are even consulted.
  if (PERMISSIONS[permission].platformOnly && !isPlatform) return false
  return TEMPLATE_PERMISSIONS[TEMPLATE_FOR[role]].includes(permission)
}

describe('legacy equivalence', () => {
  const roles: LegacyRole[] = ['admin', 'operator', 'customer', 'anonymous']

  for (const route of ROUTE_CENSUS) {
    const id = `${route.method} ${route.path}`
    for (const role of roles) {
      const testName = `${role} on ${id}`
      if (INTENTIONAL_DIVERGENCES.has(id)) {
        it.skip(`${testName} (intentional divergence)`, () => {})
        continue
      }
      it(testName, () => {
        expect(engineAllows(role, route.permission)).toBe(legacyAllows(role, route.legacyMarker))
      })
    }
  }
})
