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

/**
 * A placeholder that can never collide with a real row: `id` defaults to
 * `uuid()` (v4), which never generates the nil UUID. Used below to key
 * `upsert` on the primary key when no existing row was found, so the
 * `create` branch runs.
 */
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
    // Write-time enforcement: AuthorizationService already denies a
    // platform-only permission at read time for a non-platform user, but
    // that leaves the assignment itself possible — this is the only place
    // that actually creates the grant, so it is where assignment must be
    // refused too.
    if (permission.is_platform_only && !target.tenant?.is_platform) {
      throw AppException.businessRule('authz.platform_only_permission')
    }

    const eventId = cmd.eventId ?? null

    // Prisma types the compound `(user_id, permission_id, scope_type,
    // event_id)` unique key's `event_id` as non-nullable `string`, even
    // though the column — and the physical NULLS NOT DISTINCT index
    // backing it — is nullable. That is a known Prisma limitation with
    // compound unique keys over a nullable column: `upsert`/`findUnique`
    // cannot look up a row by a null member. A global grant's `event_id`
    // is always null, so `findFirst` (a normal filter, which handles NULL
    // correctly) locates any existing row first; `upsert` is then keyed
    // on that row's real, never-null primary key. This costs the
    // atomicity of a single-query upsert — a concurrent duplicate grant
    // in the tiny window between the two calls would surface as an
    // uncaught unique-constraint error rather than being silently wrong,
    // which is an acceptable trade for an admin-only, low-concurrency
    // operation.
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
