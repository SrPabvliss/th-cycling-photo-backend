import type { PrincipalPermissions } from '../principal'

export const PERMISSION_REPOSITORY = Symbol('PERMISSION_REPOSITORY')

export interface IPermissionRepository {
  load(userId: string): Promise<PrincipalPermissions>
}
