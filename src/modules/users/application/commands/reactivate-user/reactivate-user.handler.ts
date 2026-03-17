import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import type { IUserReadRepository, IUserWriteRepository } from '@users/domain/ports'
import { USER_READ_REPOSITORY, USER_WRITE_REPOSITORY } from '@users/domain/ports'
import { ReactivateUserCommand } from './reactivate-user.command'

@CommandHandler(ReactivateUserCommand)
export class ReactivateUserHandler implements ICommandHandler<ReactivateUserCommand> {
  constructor(
    @Inject(USER_READ_REPOSITORY) private readonly readRepo: IUserReadRepository,
    @Inject(USER_WRITE_REPOSITORY) private readonly writeRepo: IUserWriteRepository,
  ) {}

  async execute(command: ReactivateUserCommand): Promise<EntityIdProjection> {
    const user = await this.readRepo.findById(command.userId)
    if (!user) throw AppException.notFound('User', command.userId)

    user.reactivate()
    await this.writeRepo.save(user)

    return { id: user.id }
  }
}
