import { Inject, Logger } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { PERMISSIONS, type PermissionKey } from '@shared/authorization/domain/permission-catalog'
import {
  type IPermissionRepository,
  PERMISSION_REPOSITORY,
} from '@shared/authorization/domain/ports/permission-repository.port'
import { AppException } from '@shared/domain'
import {
  CONSENT_TYPE,
  POLICY_VERSIONS,
  REQUIRED_CONSENT_TYPES,
} from '../../../domain/constants/consent.constants'
import {
  PROMPT_GLOBAL_COOLDOWN_MS,
  PROMPT_PRIORITY,
  type PromptKey,
} from '../../../domain/constants/user-prompt.constants'
import {
  AUTH_USER_REPOSITORY,
  CONSENT_REPOSITORY,
  type IAuthUserRepository,
  type IConsentRepository,
  type IUserPromptSnoozeRepository,
  USER_PROMPT_SNOOZE_REPOSITORY,
} from '../../../domain/ports'
import type { MeProjection } from '../../projections'
import { GetMeQuery } from './get-me.query'

const PROMPT_CONDITIONS: Record<PromptKey, (me: MeProjection) => boolean> = {
  email_verification: (me) => !me.emailVerified,
  personal_profile: (me) => !me.hasPersonalProfile,
}

@QueryHandler(GetMeQuery)
export class GetMeHandler implements IQueryHandler<GetMeQuery> {
  private readonly logger = new Logger(GetMeHandler.name)

  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    @Inject(CONSENT_REPOSITORY) private readonly consentRepo: IConsentRepository,
    @Inject(PERMISSION_REPOSITORY) private readonly permissionRepo: IPermissionRepository,
    @Inject(USER_PROMPT_SNOOZE_REPOSITORY)
    private readonly promptSnoozeRepo: IUserPromptSnoozeRepository,
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

    me.pendingPrompts = await this.findPendingPrompts(query.userId, me)

    return me
  }

  private async findPendingConsents(userId: string): Promise<string[]> {
    try {
      const accepted = await this.consentRepo.findAcceptedTypes(
        userId,
        POLICY_VERSIONS[CONSENT_TYPE.TERMS_PRIVACY],
      )
      return REQUIRED_CONSENT_TYPES.filter((type) => !accepted.includes(type))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to read consents for user ${userId}: ${message}`)
      return []
    }
  }

  private async findPendingPrompts(userId: string, me: MeProjection): Promise<string[]> {
    try {
      if ((me.pendingConsents ?? []).length > 0) return []
      if (me.isProtected || me.isPlatform) return []

      const lastSnoozedAt = await this.promptSnoozeRepo.lastSnoozedAt(userId)
      if (lastSnoozedAt && Date.now() - lastSnoozedAt.getTime() < PROMPT_GLOBAL_COOLDOWN_MS) {
        return []
      }

      const snoozes = await this.promptSnoozeRepo.findByUser(userId)
      const now = Date.now()
      const snoozedKeys = new Set(
        snoozes
          .filter((snooze) => snooze.snoozedUntil.getTime() > now)
          .map((snooze) => snooze.promptKey),
      )

      return PROMPT_PRIORITY.filter((key) => PROMPT_CONDITIONS[key](me) && !snoozedKeys.has(key))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to read prompts for user ${userId}: ${message}`)
      return []
    }
  }
}
