import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import {
  AUTHORIZATION_CACHE,
  type IAuthorizationCache,
} from '../../../domain/ports/authorization-cache.port'
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

    await this.prisma.user.update({
      where: { id: cmd.userId },
      data: { permission_template_id: template.id, permissions_version: { increment: 1 } },
    })
    await this.cache.invalidate(cmd.userId)
  }
}
