import type { PermissionKey } from '../../../domain/permission-catalog'
import type { GrantEffectValue, GrantScopeType } from '../../../domain/principal'

export class GrantPermissionCommand {
  constructor(
    public readonly userId: string,
    public readonly key: PermissionKey,
    public readonly effect: GrantEffectValue,
    public readonly grantedById: string,
    public readonly scopeType: GrantScopeType = 'global',
    public readonly eventId?: string,
  ) {}
}
