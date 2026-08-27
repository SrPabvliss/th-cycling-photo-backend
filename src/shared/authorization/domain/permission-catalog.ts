export interface PermissionMeta {
  category: string
  platformOnly: boolean
  eventScope: boolean
}

const E = (platformOnly: boolean, eventScope: boolean, category: string): PermissionMeta => ({
  category,
  platformOnly,
  eventScope,
})

export const PERMISSIONS = {
  // events
  'event.read': E(false, true, 'events'),
  'event.read.all': E(true, false, 'events'),
  'event.stats.read': E(false, false, 'events'),
  'event.create': E(false, false, 'events'),
  'event.update': E(false, true, 'events'),
  'event.archive': E(false, true, 'events'),
  'event.restore': E(false, true, 'events'),
  'event.delete': E(false, true, 'events'),
  'event.freeze': E(true, true, 'events'),
  'event.collaborator.read': E(false, true, 'events'),
  'event.collaborator.assign': E(true, true, 'events'),
  'event.collaborator.unassign': E(true, true, 'events'),
  'event.photo_quota.set': E(true, false, 'events'),
  // event assets
  'event_asset.presign': E(false, true, 'event_assets'),
  'event_asset.confirm': E(false, true, 'event_assets'),
  'event_asset.delete': E(false, true, 'event_assets'),
  // event types
  'event_type.read': E(false, false, 'catalogs'),
  // photos
  'photo.read': E(false, true, 'photos'),
  'photo.search': E(false, false, 'photos'),
  'photo.download': E(false, true, 'photos'),
  'photo.upload': E(false, true, 'photos'),
  'photo.delete': E(false, true, 'photos'),
  'photo.review': E(false, true, 'photos'),
  'photo.bib.create': E(false, true, 'photos'),
  'photo.bib.delete': E(false, true, 'photos'),
  'photo.bib.correct': E(false, true, 'photos'),
  'photo.color.create': E(false, true, 'photos'),
  'photo.color.delete': E(false, true, 'photos'),
  'photo.color.correct': E(false, true, 'photos'),
  'photo.category.assign': E(false, true, 'photos'),
  'photo.retouch.read': E(true, true, 'photos'), // Ruling 22 (TIT-38 Task 13 fix report): retouch queries carry no EventScope filtering
  'photo.retouch.upload': E(false, true, 'photos'),
  'photo.retouch.flag': E(false, true, 'photos'),
  // photo categories
  'photo_category.create': E(false, false, 'catalogs'),
  'photo_category.event.assign': E(false, true, 'catalogs'),
  'photo_category.event.remove': E(false, true, 'catalogs'),
  // orders
  'order.read': E(false, true, 'orders'),
  'order.stats.read': E(false, false, 'orders'),
  'order.create': E(false, true, 'orders'),
  'order.notify_payment': E(false, true, 'orders'),
  'order.confirm_payment': E(false, true, 'orders'),
  'order.deliver': E(false, true, 'orders'),
  'order.delivery.regenerate': E(false, true, 'orders'),
  'order.cancel': E(false, true, 'orders'),
  'order.gift': E(true, true, 'orders'),
  'order.convert_to_gift': E(true, true, 'orders'),
  'order.convert_to_sale': E(true, true, 'orders'),
  'order.payment_method.set': E(false, false, 'orders'),
  // payments
  'payment.intent.create': E(false, false, 'payments'),
  'payment.confirm': E(false, false, 'payments'),
  'payment.transaction.read': E(false, false, 'payments'),
  // cart
  'cart.checkout': E(false, false, 'cart'),
  // preview links
  'preview_link.read': E(false, true, 'previews'),
  'preview_link.create': E(false, true, 'previews'),
  // operator dashboard
  'dashboard.operator.read': E(true, false, 'dashboard'), // Ruling 22 (TIT-38 Task 13 fix report): operator dashboard queries carry no EventScope filtering
  'dashboard.review_queue.read': E(true, true, 'dashboard'), // Ruling 22 (TIT-38 Task 13 fix report): review queue queries carry no EventScope filtering
  // notifications
  'notification.read': E(false, false, 'notifications'),
  'notification.mark_read': E(false, false, 'notifications'),
  // pricing
  'pricing.config.set': E(false, true, 'pricing'),
  'pricing.config.clear': E(false, true, 'pricing'),
  // buyers and users
  'buyer.read': E(true, false, 'buyers'),
  'user.read': E(true, false, 'users'),
  'user.create': E(true, false, 'users'),
  'user.update': E(true, false, 'users'),
  'user.deactivate': E(true, false, 'users'),
  'user.reactivate': E(true, false, 'users'),
  'user.reset_password': E(true, false, 'users'),
  'user.avatar.manage': E(true, false, 'users'),
  // tenants and administration
  'tenant.read': E(true, false, 'tenants'),
  'tenant.quota.set': E(true, false, 'tenants'),
  'tenant.profile.read': E(false, false, 'tenants'),
  'tenant.profile.update': E(false, false, 'tenants'),
  'tenant.payout_method.read': E(false, false, 'tenants'),
  'tenant.payout_method.manage': E(false, false, 'tenants'),
  'permission.grant': E(true, false, 'admin'),
  // tenant contracts
  'contract.read': E(true, false, 'contracts'),
  'contract.issue': E(true, false, 'contracts'),
  'contract.revoke': E(true, false, 'contracts'),
} as const satisfies Record<string, PermissionMeta>

export type PermissionKey = keyof typeof PERMISSIONS

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[]

export function isPermissionKey(value: string): value is PermissionKey {
  return Object.hasOwn(PERMISSIONS, value)
}
