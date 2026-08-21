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
import { BulkAssignCategoryCommand } from './bulk-assign-category.command'

@CommandHandler(BulkAssignCategoryCommand)
export class BulkAssignCategoryHandler implements ICommandHandler<BulkAssignCategoryCommand> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository,
    @Inject(PHOTO_WRITE_REPOSITORY) private readonly writeRepo: IPhotoWriteRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly freeze: FreezeStateService,
  ) {}

  /**
   * `photoIds` can span events, so there is no single entity to scope-load. Instead resolve the
   * distinct in-scope events, assert against each, then let the write re-apply the same filter so
   * an id the caller couldn't enumerate is never updated even if the assert loop were bypassed.
   */
  async execute(command: BulkAssignCategoryCommand): Promise<{ updated: number }> {
    const scope = await this.authz.resolveEventScope(command.userId)
    const eventIds = await this.readRepo.getDistinctEventIdsForPhotoIds(command.photoIds, scope)
    await Promise.all(
      eventIds.map(async (eventId) => {
        await this.authz.assert(command.userId, 'photo.category.assign', eventId)
        await this.freeze.assertNotFrozen(eventId)
      }),
    )

    const updated = await this.writeRepo.bulkUpdateCategory(
      command.photoIds,
      command.photoCategoryId,
      scope,
    )
    return { updated }
  }
}
