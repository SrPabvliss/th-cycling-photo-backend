/**
 * Routes whose access deliberately changes in TIT-38. Everything not listed
 * here MUST behave identically before and after. Each entry is
 * `${METHOD} ${path}` exactly as the route census emits it.
 *
 * 18 routes (Appendix B of docs/superpowers/plans/2026-08-17-tit-38-authorization-engine.md).
 * This set skips ALL FOUR legacy roles for a listed route — use it only when
 * every role's behaviour genuinely changes. For a divergence that affects a
 * single role, use `ROLE_INTENTIONAL_DIVERGENCES` below instead; adding a
 * single-role change here would silently discard the other three roles'
 * valid assertions.
 *
 * `POST /preview/:token/orders` is deliberately NOT in this list — Ruling 19
 * corrected it from `@Public()` to `@Authenticated()`, which reproduces the
 * legacy `NONE` behaviour exactly (any authenticated user, `request.user`
 * populated), so it is no longer a divergence. See Appendix B.
 */
export const INTENTIONAL_DIVERGENCES: ReadonlySet<string> = new Set([
  // Group A — were open to any authenticated user, now explicitly self-service
  // (no effective access change, just an explicit marker)
  'GET /auth/me',
  'POST /auth/consents',
  'POST /cart/merge',
  'GET /users/me/phones',
  'POST /users/me/phones',
  'PATCH /users/me/phones/:phoneId',
  'DELETE /users/me/phones/:phoneId',
  'PATCH /users/me/phones/:phoneId/primary',
  // Group B — were open to any authenticated user, now permission + scope
  // (closes the hole where a logged-in buyer could enumerate every event and photo)
  'GET /events',
  'GET /events/stats',
  'GET /events/:slug',
  'GET /events/:eventId/photos',
  'GET /events/:eventId/photos/resume-point',
  'GET /photos/search',
  'GET /photos/:id',
  'GET /photos/:id/similar',
  'GET /photos/view/:slug',
  // Group C — correction
  'GET /event-types', // was open to any authenticated user; now staff-only
])

/**
 * Role-qualified divergences: a route where only ONE of the four legacy
 * roles diverges from `RolesGuard`, not all four. Each entry is
 * `${role} ${METHOD} ${path}`, matching the whole-route id format above with
 * a role prefix, so the legacy-equivalence matrix skips exactly that one
 * role/route assertion and still asserts the other three roles on the same
 * route.
 *
 * Owner decision, 2026-08-18 (Appendix B): TitanTV admins CAN buy photos.
 * `cart.checkout` and `order.create` were removed from `ADMIN_EXCLUDED`
 * (src/shared/authorization/domain/permission-template.constants.ts), so
 * `platform_admin` now holds both. That makes `admin` diverge from legacy on
 * exactly these two routes — operator, customer and anonymous are unaffected
 * on both, so a whole-route entry in `INTENTIONAL_DIVERGENCES` would discard
 * six still-valid assertions for no reason. See Appendix B.
 */
export const ROLE_INTENTIONAL_DIVERGENCES: ReadonlySet<string> = new Set([
  'admin POST /cart/checkout',
  'admin POST /public/events/:eventId/orders',
])
