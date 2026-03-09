import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import { MarkPhotoClassifiedCommand } from './mark-photo-classified.command'

@CommandHandler(MarkPhotoClassifiedCommand)
export class MarkPhotoClassifiedHandler implements ICommandHandler<MarkPhotoClassifiedCommand> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: MarkPhotoClassifiedCommand): Promise<EntityIdProjection> {
    const photo = await this.photoReadRepo.findById(command.photoId)
    if (!photo) throw AppException.notFound('Photo', command.photoId)

    await this.prisma.photo.update({
      where: { id: command.photoId },
      data: { classified_at: new Date() },
    })

    return { id: command.photoId }
  }
}
