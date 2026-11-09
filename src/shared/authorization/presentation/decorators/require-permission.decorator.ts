import { SetMetadata } from '@nestjs/common'
import type { PermissionKey } from '../../domain/permission-catalog'

export const PERMISSION_KEY = 'authz:permission'

/**
 * Marks a route as requiring `key`. `PermissionGuard` checks only that the principal holds it
 * somewhere; per-event checks happen in the handler once the entity is loaded.
 */
export const RequirePermission = (key: PermissionKey) => SetMetadata(PERMISSION_KEY, key)
