import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import {
  AUTHORIZATION_CACHE,
  type IAuthorizationCache,
} from '../../../domain/ports/authorization-cache.port'
import { countActivePermissionGrantHolders } from '../../../infrastructure/queries/count-active-permission-grant-holders'
import { assertGrantScopePairing } from '../assert-grant-scope-pairing'
import { RevokePermissionCommand } from './revoke-permission.command'

@CommandHandler(RevokePermissionCommand)
export class RevokePermissionHandler implements ICommandHandler<RevokePermissionCommand> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTHORIZATION_CACHE) private readonly cache: IAuthorizationCache,
  ) {}

  async execute(cmd: RevokePermissionCommand): Promise<void> {
    assertGrantScopePairing(cmd.scopeType, cmd.eventId)

    const target = await this.prisma.user.findUnique({
      where: { id: cmd.userId },
      select: { id: true, is_protected: true },
    })
    if (!target) throw AppException.notFound('entities.user', cmd.userId)
    if (target.is_protected) throw AppException.businessRule('authz.protected_account')

    if (cmd.key === 'permission.grant') {
      // Total active holders, `cmd.userId` included, since the revoke hasn't happened yet. `<= 1`
      // blocks both the sole-holder case and, conservatively, any revoke of `permission.grant`
      // while the platform is down to one holder.
      const holders = await countActivePermissionGrantHolders(this.prisma)
      if (holders <= 1) {
        throw AppException.businessRule('authz.last_grant_admin')
      }
    }

    await this.prisma.userPermissionGrant.deleteMany({
      where: {
        user_id: cmd.userId,
        permission: { key: cmd.key },
        scope_type: cmd.scopeType,
        event_id: cmd.eventId ?? null,
      },
    })
    await this.prisma.user.update({
      where: { id: cmd.userId },
      data: { permissions_version: { increment: 1 } },
    })
    await this.cache.invalidate(cmd.userId)
  }
}
