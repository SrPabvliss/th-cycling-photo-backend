/**
 * Routes whose access deliberately changes in TIT-38; everything else must behave identically
 * before and after. Entries are `${METHOD} ${path}`, exactly as the route census emits them.
 *
 * Listing a route here skips ALL FOUR legacy roles, so use it only when every role's behaviour
 * changes — for a single-role divergence use `ROLE_INTENTIONAL_DIVERGENCES` below, or the other
 * three roles' valid assertions are silently discarded.
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
 * Divergences where only ONE of the four legacy roles changes. Entries are
 * `${role} ${METHOD} ${path}`, so the matrix skips that one assertion and keeps the other three.
 *
 * All of these follow from the owner decision that TitanTV admins can buy photos: `cart.checkout`
 * and `order.create` left `ADMIN_EXCLUDED`, and the TIT-51 payment routes are the rest of that same
 * purchase flow — an admin who may place an order may also pay for it.
 */
export const ROLE_INTENTIONAL_DIVERGENCES: ReadonlySet<string> = new Set([
  'admin POST /cart/checkout',
  'admin POST /public/events/:eventId/orders',
  'admin PATCH /orders/payment-method',
  'admin POST /payments/intent',
  'admin POST /payments/confirm',
  'admin GET /payments/transactions/:clientTransactionId',

  // TIT-40: operator role loses global retouching capabilities in favor of per-event grants.
  'operator GET /operator/retouch/orders/:orderId',
  'operator GET /operator/retouch/orders',
  'operator GET /operator/events/:eventSlug/retouch-queue',
  'operator GET /photos/pending-retouch',
  'operator POST /photos/:id/retouched/presigned-url',
  'operator POST /photos/:id/retouched/confirm',
  'operator PATCH /photos/:id/retouch-flag',

  // TIT-42: payout configuration moves from /payphone-account to /tenants/me/payout-methods.
  'admin GET /payphone-account',
  'admin PUT /payphone-account',
  'operator GET /payphone-account',
  'operator PUT /payphone-account',

  // Event detail redesign: the money row is unconditional, so TitanTV staff need to read orders.
  'operator GET /orders',
  'operator GET /orders/stats',
  'operator GET /orders/:id',
])
