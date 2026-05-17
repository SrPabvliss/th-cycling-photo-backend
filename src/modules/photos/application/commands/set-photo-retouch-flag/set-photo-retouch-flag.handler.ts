import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IPhotoReadRepository,
  type IPhotoWriteRepository,
  PHOTO_READ_REPOSITORY,
  PHOTO_WRITE_REPOSITORY,
} from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { SetPhotoRetouchFlagCommand } from './set-photo-retouch-flag.command'

@CommandHandler(SetPhotoRetouchFlagCommand)
export class SetPhotoRetouchFlagHandler implements ICommandHandler<SetPhotoRetouchFlagCommand> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY)
    private readonly photoRead: IPhotoReadRepository,
    @Inject(PHOTO_WRITE_REPOSITORY)
    private readonly photoWrite: IPhotoWriteRepository,
  ) {}

  async execute(command: SetPhotoRetouchFlagCommand): Promise<void> {
    const photo = await this.photoRead.findById(command.photoId)
    if (!photo) {
      throw AppException.notFound('Photo', command.photoId)
    }

    await this.photoWrite.setRequiresRetouch(command.photoId, command.value)
  }
}
