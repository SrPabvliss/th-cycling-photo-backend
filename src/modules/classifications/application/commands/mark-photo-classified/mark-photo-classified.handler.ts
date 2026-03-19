import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IPhotoReadRepository,
  type IPhotoWriteRepository,
  PHOTO_READ_REPOSITORY,
  PHOTO_WRITE_REPOSITORY,
} from '@photos/domain/ports'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { MarkPhotoClassifiedCommand } from './mark-photo-classified.command'

@CommandHandler(MarkPhotoClassifiedCommand)
export class MarkPhotoClassifiedHandler implements ICommandHandler<MarkPhotoClassifiedCommand> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(PHOTO_WRITE_REPOSITORY) private readonly photoWriteRepo: IPhotoWriteRepository,
  ) {}

  async execute(command: MarkPhotoClassifiedCommand): Promise<EntityIdProjection> {
    const photo = await this.photoReadRepo.findById(command.photoId)
    if (!photo) throw AppException.notFound('Photo', command.photoId)

    await this.photoWriteRepo.markAsClassified(command.photoId, command.audit?.userId)

    return { id: command.photoId }
  }
}
