import { AppException } from '@shared/domain'
import type { GrantScopeType } from '../../domain/principal'

/**
 * `UserPermissionGrant.event_id` must be set if and only if `scope_type` is `'event'`. Nothing at
 * the database level enforces that (a CHECK constraint was deferred) and `PermissionRepository`
 * silently mishandles both malformed shapes — dropping one, reading the other back as global — so
 * the two handlers that write these rows call this first.
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
