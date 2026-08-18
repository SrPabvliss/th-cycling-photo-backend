import { AppException } from '@shared/domain'
import type { GrantScopeType } from '../../domain/principal'

/**
 * Ruling 13 (TIT-38 Task 13): `UserPermissionGrant.scope_type` and
 * `event_id` must agree — `event_id` set if and only if `scope_type` is
 * `'event'`. Nothing at the database level prevents the malformed shapes
 * (`'event'` with a null `event_id`, or `'global'` with an `event_id` set),
 * and `PermissionRepository` silently mishandles both: the first is
 * dropped entirely, the second is read back as a global grant. A CHECK
 * constraint was considered and deliberately deferred, so
 * `GrantPermissionHandler` and `RevokePermissionHandler` — the only code
 * that writes these rows — call this before touching the database.
 */
export function assertGrantScopePairing(scopeType: GrantScopeType, eventId?: string): void {
  const hasEventId = Boolean(eventId)
  const isEventScoped = scopeType === 'event'

  if (hasEventId === isEventScoped) return

  throw AppException.validationFailed({
    eventId: [
      isEventScoped
        ? 'eventId is required when scopeType is "event"'
        : 'eventId must be omitted when scopeType is "global"',
    ],
  })
}
