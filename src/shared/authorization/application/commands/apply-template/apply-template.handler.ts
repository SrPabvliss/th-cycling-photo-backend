import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import {
  AUTHORIZATION_CACHE,
  type IAuthorizationCache,
} from '../../../domain/ports/authorization-cache.port'
import { countActivePermissionGrantHolders } from '../../../infrastructure/queries/count-active-permission-grant-holders'
import { ApplyTemplateCommand } from './apply-template.command'

@CommandHandler(ApplyTemplateCommand)
export class ApplyTemplateHandler implements ICommandHandler<ApplyTemplateCommand> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTHORIZATION_CACHE) private readonly cache: IAuthorizationCache,
  ) {}

  async execute(cmd: ApplyTemplateCommand): Promise<void> {
    const template = await this.prisma.permissionTemplate.findUniqueOrThrow({
      where: { key: cmd.templateKey },
    })
    const target = await this.prisma.user.findUniqueOrThrow({
      where: { id: cmd.userId },
      select: { is_protected: true, tenant: { select: { is_platform: true } } },
    })
    if (target.is_protected) throw AppException.businessRule('authz.protected_account')
    // Write-time enforcement: mirrors GrantPermissionHandler's platform-only
    // check. AuthorizationService already denies platform-only permissions
    // at read time, but that leaves the template assignment itself
    // possible — this is the only place that performs it.
    if (template.is_platform_only && !target.tenant?.is_platform) {
      throw AppException.businessRule('authz.platform_only_permission')
    }

    // TIT-38 Task 13 fix report: a template swap is a third route to the
    // same lockout Revoke/DeactivateUserHandler already guard against —
    // moving the last platform_admin onto a template without
    // `permission.grant` removes their effective grant just as surely as
    // revoking it directly. The update and the check both run inside one
    // transaction rather than replicating AuthorizationService's
    // grant-beats-template precedence by hand: this way the check runs
    // against the real post-swap state, including the case where the
    // target also holds `permission.grant` through a direct UBAC grant —
    // which a template swap never touches, so it poses no risk at all —
    // without this handler needing to know that. If the count comes back
    // 0, throwing here aborts the transaction and the `update` never
    // persists.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: cmd.userId },
        data: { permission_template_id: template.id, permissions_version: { increment: 1 } },
      })

      const remainingHolders = await countActivePermissionGrantHolders(tx)
      if (remainingHolders === 0) {
        throw AppException.businessRule('authz.last_grant_admin')
      }
    })

    await this.cache.invalidate(cmd.userId)
  }
}
