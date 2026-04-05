import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { User } from '@users/domain/entities'
import type { IUserReadRepository, IUserWriteRepository } from '@users/domain/ports'
import { USER_READ_REPOSITORY, USER_WRITE_REPOSITORY } from '@users/domain/ports'
import { hashSync } from 'bcryptjs'
import { CreateUserCommand } from './create-user.command'

const BCRYPT_ROUNDS = 10

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    @Inject(USER_WRITE_REPOSITORY) private readonly writeRepo: IUserWriteRepository,
    @Inject(USER_READ_REPOSITORY) private readonly readRepo: IUserReadRepository,
  ) {}

  async execute(command: CreateUserCommand): Promise<EntityIdProjection> {
    const existing = await this.readRepo.findByEmail(command.email)
    if (existing) throw AppException.conflict('user.email_already_exists', { email: command.email })

    const passwordHash = hashSync(command.password, BCRYPT_ROUNDS)

    const user = User.create({
      email: command.email,
      passwordHash,
      firstName: command.firstName,
      lastName: command.lastName,
    })

    const saved = await this.writeRepo.save(user, command.role)

    return { id: saved.id }
  }
}
