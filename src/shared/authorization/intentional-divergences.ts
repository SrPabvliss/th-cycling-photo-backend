/**
 * Routes whose access deliberately changes in TIT-38. Everything not listed
 * here MUST behave identically before and after. Each entry is
 * `${METHOD} ${path}` exactly as the route census emits it.
 *
 * 18 routes (Appendix B of docs/superpowers/plans/2026-08-17-tit-38-authorization-engine.md).
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
