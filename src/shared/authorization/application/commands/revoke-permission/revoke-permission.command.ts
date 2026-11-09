import type { PermissionKey } from '../../../domain/permission-catalog'
import type { GrantScopeType } from '../../../domain/principal'

export class RevokePermissionCommand {
  constructor(
    public readonly userId: string,
    public readonly key: PermissionKey,
    public readonly revokedById: string,
    public readonly scopeType: GrantScopeType = 'global',
    public readonly eventId?: string,
  ) {}
}
