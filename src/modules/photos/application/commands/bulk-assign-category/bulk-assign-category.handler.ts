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
  ) {}

  /**
   * `photoIds` can span multiple events, so there is no single entity to
   * scope-load. Instead: resolve the distinct events among `photoIds` that
   * fall inside the caller's scope (out-of-scope photos are silently
   * excluded, not reported — same non-disclosure as everywhere else),
   * assert the permission against each of those events, then let the
   * write itself re-apply the same scope filter so an id the caller could
   * not enumerate never gets updated even if the assert loop were somehow
   * bypassed.
   */
  async execute(command: BulkAssignCategoryCommand): Promise<{ updated: number }> {
    const scope = await this.authz.resolveEventScope(command.userId)
    const eventIds = await this.readRepo.getDistinctEventIdsForPhotoIds(command.photoIds, scope)
    await Promise.all(
      eventIds.map((eventId) =>
        this.authz.assert(command.userId, 'photo.category.assign', eventId),
      ),
    )

    const updated = await this.writeRepo.bulkUpdateCategory(
      command.photoIds,
      command.photoCategoryId,
      scope,
    )
    return { updated }
  }
}
