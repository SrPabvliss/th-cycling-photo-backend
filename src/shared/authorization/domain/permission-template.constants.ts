import { ALL_PERMISSION_KEYS, type PermissionKey } from './permission-catalog'

export const TEMPLATE_KEYS = {
  PLATFORM_ADMIN: 'platform_admin',
  PLATFORM_STAFF: 'platform_staff',
  TENANT: 'tenant',
  CUSTOMER: 'customer',
} as const

export type TemplateKey = (typeof TEMPLATE_KEYS)[keyof typeof TEMPLATE_KEYS]

/** Reproduces every route today's `@Roles('admin','operator')` allows. */
const STAFF: PermissionKey[] = [
  'event.read',
  'event.stats.read',
  'event.create',
  'event.update',
  'event.collaborator.read',
  'event_asset.presign',
  'event_asset.confirm',
  'event_asset.delete',
  'event_type.read',
  'photo.read',
  'photo.search',
  'photo.download',
  'photo.upload',
  'photo.delete',
  'photo.review',
  'photo.bib.create',
  'photo.bib.delete',
  'photo.bib.correct',
  'photo.color.create',
  'photo.color.delete',
  'photo.color.correct',
  'photo.category.assign',
  'photo.retouch.read',
  'photo.retouch.upload',
  'photo.retouch.flag',
  'photo_category.create',
  'photo_category.event.assign',
  'photo_category.event.remove',
  'dashboard.operator.read',
  'dashboard.review_queue.read',
  'notification.read',
  'notification.mark_read',
]

/**
 * A tenant runs its own events end to end but never reaches retouch, buyers,
 * or the gift actions (TIT-39). Collaborator management stays with TitanTV.
 */
const TENANT: PermissionKey[] = [
  'event.read',
  'event.stats.read',
  'event.create',
  'event.update',
  'event_asset.presign',
  'event_asset.confirm',
  'event_asset.delete',
  'event_type.read',
  'photo.read',
  'photo.search',
  'photo.download',
  'photo.upload',
  'photo.delete',
  'photo.review',
  'photo.bib.create',
  'photo.bib.delete',
  'photo.bib.correct',
  'photo.color.create',
  'photo.color.delete',
  'photo.color.correct',
  'photo.category.assign',
  'photo_category.event.assign',
  'photo_category.event.remove',
  'order.read',
  'order.stats.read',
  'order.notify_payment',
  'order.confirm_payment',
  'order.deliver',
  'order.delivery.regenerate',
  'order.cancel',
  'notification.read',
  'notification.mark_read',
]

const CUSTOMER: PermissionKey[] = ['cart.checkout', 'order.create']

export const TEMPLATE_PERMISSIONS: Record<TemplateKey, PermissionKey[]> = {
  [TEMPLATE_KEYS.PLATFORM_ADMIN]: [...ALL_PERMISSION_KEYS],
  [TEMPLATE_KEYS.PLATFORM_STAFF]: STAFF,
  [TEMPLATE_KEYS.TENANT]: TENANT,
  [TEMPLATE_KEYS.CUSTOMER]: CUSTOMER,
}

export const TEMPLATE_IS_PLATFORM_ONLY: Record<TemplateKey, boolean> = {
  [TEMPLATE_KEYS.PLATFORM_ADMIN]: true,
  [TEMPLATE_KEYS.PLATFORM_STAFF]: true,
  [TEMPLATE_KEYS.TENANT]: false,
  [TEMPLATE_KEYS.CUSTOMER]: false,
}
