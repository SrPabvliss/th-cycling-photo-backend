import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import {
  USER_PHONE_READ_REPOSITORY,
  USER_PHONE_WRITE_REPOSITORY,
  USER_READ_REPOSITORY,
  USER_WRITE_REPOSITORY,
} from '@users/domain/ports'
import { UserPhoneReadRepository } from '@users/infrastructure/repositories/user-phone-read.repository'
import { UserPhoneWriteRepository } from '@users/infrastructure/repositories/user-phone-write.repository'
import { UserReadRepository } from '@users/infrastructure/repositories/user-read.repository'
import { UserWriteRepository } from '@users/infrastructure/repositories/user-write.repository'
import { BuyersController } from '@users/presentation/controllers/buyers.controller'
import { UserPhonesController } from '@users/presentation/controllers/user-phones.controller'
import { UsersController } from '@users/presentation/controllers/users.controller'
import { AddUserPhoneHandler } from './application/commands/add-user-phone/add-user-phone.handler'
import { ConfirmAvatarUploadHandler } from './application/commands/confirm-avatar-upload/confirm-avatar-upload.handler'
import { CreateUserHandler } from './application/commands/create-user/create-user.handler'
import { DeactivateUserHandler } from './application/commands/deactivate-user/deactivate-user.handler'
import { DeleteUserPhoneHandler } from './application/commands/delete-user-phone/delete-user-phone.handler'
import { GenerateAvatarUrlHandler } from './application/commands/generate-avatar-url/generate-avatar-url.handler'
import { ReactivateUserHandler } from './application/commands/reactivate-user/reactivate-user.handler'
import { ResetPasswordHandler } from './application/commands/reset-password/reset-password.handler'
import { SetPrimaryPhoneHandler } from './application/commands/set-primary-phone/set-primary-phone.handler'
import { UpdateUserHandler } from './application/commands/update-user/update-user.handler'
import { UpdateUserPhoneHandler } from './application/commands/update-user-phone/update-user-phone.handler'
import { GetBuyersListHandler } from './application/queries/get-buyers-list/get-buyers-list.handler'
import { GetUserDetailHandler } from './application/queries/get-user-detail/get-user-detail.handler'
import { GetUserPhonesHandler } from './application/queries/get-user-phones/get-user-phones.handler'
import { GetUsersListHandler } from './application/queries/get-users-list/get-users-list.handler'

const CommandHandlers = [
  CreateUserHandler,
  UpdateUserHandler,
  DeactivateUserHandler,
  ReactivateUserHandler,
  ResetPasswordHandler,
  GenerateAvatarUrlHandler,
  ConfirmAvatarUploadHandler,
  AddUserPhoneHandler,
  UpdateUserPhoneHandler,
  DeleteUserPhoneHandler,
  SetPrimaryPhoneHandler,
]
const QueryHandlers = [
  GetBuyersListHandler,
  GetUsersListHandler,
  GetUserDetailHandler,
  GetUserPhonesHandler,
]

@Module({
  imports: [CqrsModule],
  controllers: [UsersController, UserPhonesController, BuyersController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: USER_READ_REPOSITORY, useClass: UserReadRepository },
    { provide: USER_WRITE_REPOSITORY, useClass: UserWriteRepository },
    { provide: USER_PHONE_READ_REPOSITORY, useClass: UserPhoneReadRepository },
    { provide: USER_PHONE_WRITE_REPOSITORY, useClass: UserPhoneWriteRepository },
  ],
  exports: [USER_READ_REPOSITORY, USER_WRITE_REPOSITORY],
})
export class UsersModule {}
