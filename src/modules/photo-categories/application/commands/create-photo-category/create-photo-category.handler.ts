import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { PhotoCategory } from '../../../domain/entities'
import {
  type IPhotoCategoryReadRepository,
  type IPhotoCategoryWriteRepository,
  PHOTO_CATEGORY_READ_REPOSITORY,
  PHOTO_CATEGORY_WRITE_REPOSITORY,
} from '../../../domain/ports'
import { CreatePhotoCategoryCommand } from './create-photo-category.command'

@CommandHandler(CreatePhotoCategoryCommand)
export class CreatePhotoCategoryHandler implements ICommandHandler<CreatePhotoCategoryCommand> {
  constructor(
    @Inject(PHOTO_CATEGORY_READ_REPOSITORY) private readonly readRepo: IPhotoCategoryReadRepository,
    @Inject(PHOTO_CATEGORY_WRITE_REPOSITORY)
    private readonly writeRepo: IPhotoCategoryWriteRepository,
  ) {}

  async execute(command: CreatePhotoCategoryCommand): Promise<EntityIdProjection> {
    const existing = await this.readRepo.findByName(command.name)
    if (existing) throw AppException.conflict('errors.CONFLICT', { fields: 'name' })

    const category = PhotoCategory.create({ name: command.name })
    const saved = await this.writeRepo.save(category)
    return { id: String(saved.id) }
  }
}
