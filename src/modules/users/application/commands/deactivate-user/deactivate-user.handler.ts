import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { countActivePermissionGrantHolders } from '@shared/authorization/infrastructure/queries/count-active-permission-grant-holders'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import type { IUserReadRepository, IUserWriteRepository } from '@users/domain/ports'
import { USER_READ_REPOSITORY, USER_WRITE_REPOSITORY } from '@users/domain/ports'
import { DeactivateUserCommand } from './deactivate-user.command'

@CommandHandler(DeactivateUserCommand)
export class DeactivateUserHandler implements ICommandHandler<DeactivateUserCommand> {
  constructor(
    @Inject(USER_READ_REPOSITORY) private readonly readRepo: IUserReadRepository,
    @Inject(USER_WRITE_REPOSITORY) private readonly writeRepo: IUserWriteRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: DeactivateUserCommand): Promise<EntityIdProjection> {
    const user = await this.readRepo.findById(command.userId)
    if (!user) throw AppException.notFound('User', command.userId)

    // TIT-38 Task 13, Layer 2: the break-glass account rejects every
    // mutating operation, including deactivating itself.
    const guard = await this.prisma.user.findUniqueOrThrow({
      where: { id: command.userId },
      select: { is_protected: true },
    })
    if (guard.is_protected) throw AppException.businessRule('authz.protected_account')

    // TIT-38 Task 13, Layer 1: deactivating the last holder of
    // `permission.grant` is the same lockout as revoking it directly.
    // `excludeUserId` makes this the exact post-deactivation holder count
    // (see countActivePermissionGrantHolders' doc comment) — unlike
    // RevokePermissionHandler's unconditional total, this must not block
    // deactivating an unrelated user just because admins are scarce
    // elsewhere in the platform.
    const remainingHolders = await countActivePermissionGrantHolders(this.prisma, command.userId)
    if (remainingHolders === 0) {
      throw AppException.businessRule('authz.last_grant_admin')
    }

    user.deactivate()
    await this.writeRepo.save(user)

    return { id: user.id }
  }
}
