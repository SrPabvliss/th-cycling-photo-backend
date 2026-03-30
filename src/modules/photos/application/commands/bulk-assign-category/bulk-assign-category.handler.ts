import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { type IPhotoWriteRepository, PHOTO_WRITE_REPOSITORY } from '@photos/domain/ports'
import { BulkAssignCategoryCommand } from './bulk-assign-category.command'

@CommandHandler(BulkAssignCategoryCommand)
export class BulkAssignCategoryHandler implements ICommandHandler<BulkAssignCategoryCommand> {
  constructor(@Inject(PHOTO_WRITE_REPOSITORY) private readonly writeRepo: IPhotoWriteRepository) {}

  async execute(command: BulkAssignCategoryCommand): Promise<{ updated: number }> {
    const updated = await this.writeRepo.bulkUpdateCategory(
      command.photoIds,
      command.photoCategoryId,
    )
    return { updated }
  }
}
