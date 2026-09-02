import { FreezeStateService } from '@events/application/services/freeze-state.service'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IPhotoReadRepository,
  type IPhotoWriteRepository,
  PHOTO_READ_REPOSITORY,
  PHOTO_WRITE_REPOSITORY,
} from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { SetPhotoRetouchFlagCommand } from './set-photo-retouch-flag.command'

@CommandHandler(SetPhotoRetouchFlagCommand)
export class SetPhotoRetouchFlagHandler implements ICommandHandler<SetPhotoRetouchFlagCommand> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY)
    private readonly photoRead: IPhotoReadRepository,
    @Inject(PHOTO_WRITE_REPOSITORY)
    private readonly photoWrite: IPhotoWriteRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly freeze: FreezeStateService,
  ) {}

  async execute(command: SetPhotoRetouchFlagCommand): Promise<void> {
    const scope = await this.authz.resolveEventScope(command.userId)
    const photo = await this.photoRead.findByIdInScope(command.photoId, scope)
    if (!photo) {
      throw AppException.notFound('entities.photo', command.photoId)
    }
    await this.authz.assert(command.userId, 'photo.retouch.flag', photo.eventId)
    await this.freeze.assertNotFrozen(photo.eventId)

    await this.photoWrite.setRequiresRetouch(command.photoId, command.value)
  }
}
