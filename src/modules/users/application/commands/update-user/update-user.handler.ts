import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import type { IUserReadRepository, IUserWriteRepository } from '@users/domain/ports'
import { USER_READ_REPOSITORY, USER_WRITE_REPOSITORY } from '@users/domain/ports'
import { UpdateUserCommand } from './update-user.command'

@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand> {
  constructor(
    @Inject(USER_READ_REPOSITORY) private readonly readRepo: IUserReadRepository,
    @Inject(USER_WRITE_REPOSITORY) private readonly writeRepo: IUserWriteRepository,
  ) {}

  async execute(command: UpdateUserCommand): Promise<EntityIdProjection> {
    const user = await this.readRepo.findById(command.userId)
    if (!user) throw AppException.notFound('User', command.userId)

    user.update({
      firstName: command.firstName,
      lastName: command.lastName,
    })

    await this.writeRepo.save(user)

    return { id: user.id }
  }
}
