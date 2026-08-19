import { Inject, Logger } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PERMISSIONS, type PermissionKey } from '@shared/authorization/domain/permission-catalog'
import {
  type IPermissionRepository,
  PERMISSION_REPOSITORY,
} from '@shared/authorization/domain/ports/permission-repository.port'
import { AppException } from '@shared/domain'
import { POLICY_VERSION, REQUIRED_CONSENT_TYPES } from '../../../domain/constants/consent.constants'
import {
  AUTH_USER_REPOSITORY,
  CONSENT_REPOSITORY,
  type IAuthUserRepository,
  type IConsentRepository,
} from '../../../domain/ports'
import type { MeProjection } from '../../projections'
import { GetMeQuery } from './get-me.query'

@QueryHandler(GetMeQuery)
export class GetMeHandler implements IQueryHandler<GetMeQuery> {
  private readonly logger = new Logger(GetMeHandler.name)

  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    @Inject(CONSENT_REPOSITORY) private readonly consentRepo: IConsentRepository,
    @Inject(PERMISSION_REPOSITORY) private readonly permissionRepo: IPermissionRepository,
  ) {}

  async execute(query: GetMeQuery): Promise<MeProjection> {
    const me = await this.authUserRepo.getMe(query.userId)
    if (!me) throw AppException.businessRule('auth.user_not_found')

    if (!me.role) me.role = query.role

    me.pendingConsents = await this.findPendingConsents(query.userId)

    const p = await this.permissionRepo.load(query.userId)
    const effective = new Set<string>()
    for (const key of p.templateKeys) effective.add(key)
    for (const [key, effect] of p.globalGrants) {
      if (effect === 'allow') effective.add(key)
      else effective.delete(key)
    }
    // platform-only permissions are unreachable outside the platform tenant
    for (const key of [...effective]) {
      if (PERMISSIONS[key as PermissionKey]?.platformOnly && !p.isPlatform) effective.delete(key)
    }

    me.permissions = [...effective]
    me.tenantId = p.tenantId
    me.isPlatform = p.isPlatform

    return me
  }

  private async findPendingConsents(userId: string): Promise<string[]> {
    try {
      const accepted = await this.consentRepo.findAcceptedTypes(userId, POLICY_VERSION)
      return REQUIRED_CONSENT_TYPES.filter((type) => !accepted.includes(type))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to read consents for user ${userId}: ${message}`)
      return []
    }
  }
}
