import { SetMetadata } from '@nestjs/common'
import type { PermissionKey } from '../../domain/permission-catalog'

export const PERMISSION_KEY = 'authz:permission'

/**
 * Marks a route as requiring the given permission. `PermissionGuard`
 * performs the coarse check — does this principal hold `key` anywhere.
 * Resource-scoped (per-event) checks happen in the handler, after the
 * entity is loaded.
 */
export const RequirePermission = (key: PermissionKey) => SetMetadata(PERMISSION_KEY, key)
