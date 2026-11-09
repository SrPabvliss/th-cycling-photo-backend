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
    // Mirrors GrantPermissionHandler: read-time denial still leaves the assignment itself
    // possible, and this is the only place that performs it.
    if (template.is_platform_only && !target.tenant?.is_platform) {
      throw AppException.businessRule('authz.platform_only_permission')
    }

    // A template swap is a third route to the lockout Revoke/DeactivateUserHandler guard against:
    // moving the last platform_admin onto a template without `permission.grant` removes it just as
    // surely as revoking it. Update and check share one transaction so the count sees the real
    // post-swap state — including a direct grant a swap never touches — without this handler
    // replicating can()'s precedence. Throwing on 0 rolls the update back.
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
