import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import type { IUserReadRepository, IUserWriteRepository } from '@users/domain/ports'
import { USER_READ_REPOSITORY, USER_WRITE_REPOSITORY } from '@users/domain/ports'
import { hashSync } from 'bcryptjs'
import { ResetPasswordCommand } from './reset-password.command'

const BCRYPT_ROUNDS = 10

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<ResetPasswordCommand> {
  constructor(
    @Inject(USER_READ_REPOSITORY) private readonly readRepo: IUserReadRepository,
    @Inject(USER_WRITE_REPOSITORY) private readonly writeRepo: IUserWriteRepository,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<EntityIdProjection> {
    const user = await this.readRepo.findById(command.userId)
    if (!user) throw AppException.notFound('User', command.userId)

    const passwordHash = hashSync(command.newPassword, BCRYPT_ROUNDS)
    user.setPassword(passwordHash)
    await this.writeRepo.save(user)

    return { id: user.id }
  }
}
