import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import {
  AUTHORIZATION_CACHE,
  type IAuthorizationCache,
} from '../../../domain/ports/authorization-cache.port'
import { assertGrantScopePairing } from '../assert-grant-scope-pairing'
import { GrantPermissionCommand } from './grant-permission.command'

/** Keys the `upsert` below when no row was found, so its `create` branch runs. `uuid()` (v4)
 * never generates the nil UUID, so this can't collide with a real row. */
const NIL_UUID = '00000000-0000-0000-0000-000000000000'

@CommandHandler(GrantPermissionCommand)
export class GrantPermissionHandler implements ICommandHandler<GrantPermissionCommand> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTHORIZATION_CACHE) private readonly cache: IAuthorizationCache,
  ) {}

  async execute(cmd: GrantPermissionCommand): Promise<void> {
    assertGrantScopePairing(cmd.scopeType, cmd.eventId)

    const permission = await this.prisma.permission.findUniqueOrThrow({ where: { key: cmd.key } })
    const target = await this.prisma.user.findUniqueOrThrow({
      where: { id: cmd.userId },
      select: { is_protected: true, tenant: { select: { is_platform: true } } },
    })
    if (target.is_protected) throw AppException.businessRule('authz.protected_account')
    // `AuthorizationService` already denies platform-only keys at read time, but this is the only
    // place that creates a grant, so assignment has to be refused here too.
    if (permission.is_platform_only && !target.tenant?.is_platform) {
      throw AppException.businessRule('authz.platform_only_permission')
    }

    const eventId = cmd.eventId ?? null

    // Prisma can't look a row up by a null member of a compound unique key, and a global grant's
    // `event_id` is always null. So `findFirst` locates the row (a normal filter handles NULL),
    // then `upsert` keys on its real primary key. The cost is atomicity: a concurrent duplicate
    // grant surfaces as a unique-constraint error, acceptable for an admin-only operation.
    const existing = await this.prisma.userPermissionGrant.findFirst({
      where: {
        user_id: cmd.userId,
        permission_id: permission.id,
        scope_type: cmd.scopeType,
        event_id: eventId,
      },
      select: { id: true },
    })

    await this.prisma.userPermissionGrant.upsert({
      where: { id: existing?.id ?? NIL_UUID },
      create: {
        user_id: cmd.userId,
        permission_id: permission.id,
        scope_type: cmd.scopeType,
        event_id: eventId,
        effect: cmd.effect,
        granted_by_id: cmd.grantedById,
      },
      update: {
        effect: cmd.effect,
        granted_by_id: cmd.grantedById,
      },
    })

    await this.prisma.user.update({
      where: { id: cmd.userId },
      data: { permissions_version: { increment: 1 } },
    })
    await this.cache.invalidate(cmd.userId)
  }
}
