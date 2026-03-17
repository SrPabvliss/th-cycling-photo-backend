import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { USER_READ_REPOSITORY, USER_WRITE_REPOSITORY } from '@users/domain/ports'
import { UserReadRepository } from '@users/infrastructure/repositories/user-read.repository'
import { UserWriteRepository } from '@users/infrastructure/repositories/user-write.repository'
import { UsersController } from '@users/presentation/controllers/users.controller'
import { ConfirmAvatarUploadHandler } from './application/commands/confirm-avatar-upload/confirm-avatar-upload.handler'
import { CreateUserHandler } from './application/commands/create-user/create-user.handler'
import { DeactivateUserHandler } from './application/commands/deactivate-user/deactivate-user.handler'
import { GenerateAvatarUrlHandler } from './application/commands/generate-avatar-url/generate-avatar-url.handler'
import { ReactivateUserHandler } from './application/commands/reactivate-user/reactivate-user.handler'
import { ResetPasswordHandler } from './application/commands/reset-password/reset-password.handler'
import { UpdateUserHandler } from './application/commands/update-user/update-user.handler'
import { GetUserDetailHandler } from './application/queries/get-user-detail/get-user-detail.handler'
import { GetUsersListHandler } from './application/queries/get-users-list/get-users-list.handler'

const CommandHandlers = [
  CreateUserHandler,
  UpdateUserHandler,
  DeactivateUserHandler,
  ReactivateUserHandler,
  ResetPasswordHandler,
  GenerateAvatarUrlHandler,
  ConfirmAvatarUploadHandler,
]
const QueryHandlers = [GetUsersListHandler, GetUserDetailHandler]

@Module({
  imports: [CqrsModule],
  controllers: [UsersController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: USER_READ_REPOSITORY, useClass: UserReadRepository },
    { provide: USER_WRITE_REPOSITORY, useClass: UserWriteRepository },
  ],
  exports: [USER_READ_REPOSITORY, USER_WRITE_REPOSITORY],
})
export class UsersModule {}
