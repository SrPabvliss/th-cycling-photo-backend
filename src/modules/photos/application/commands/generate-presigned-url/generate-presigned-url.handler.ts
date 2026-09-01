import { FreezeStateService } from '@events/application/services/freeze-state.service'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { PresignedUrlProjection } from '@photos/application/projections'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { GeneratePresignedUrlCommand } from './generate-presigned-url.command'

const PRESIGNED_URL_EXPIRY_SECONDS = 300

@CommandHandler(GeneratePresignedUrlCommand)
export class GeneratePresignedUrlHandler implements ICommandHandler<GeneratePresignedUrlCommand> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly freeze: FreezeStateService,
  ) {}

  /**
   * Validates event existence, checks for duplicates, and generates a presigned upload URL.
   *
   * `IEventReadRepository.findById` is unscoped and belongs to another module, so the
   * tenant-boundary check runs in-memory via `EventScope.includesEvent()`. An out-of-scope event
   * 404s exactly like an unknown one.
   */
  async execute(command: GeneratePresignedUrlCommand): Promise<PresignedUrlProjection> {
    const scope = await this.authz.resolveEventScope(command.userId)
    const event = await this.eventReadRepo.findById(command.eventId)
    if (!event || !scope.includesEvent(event)) {
      throw AppException.notFound('Event', command.eventId)
    }
    await this.authz.assert(command.userId, 'photo.upload', event.id)
    await this.freeze.assertNotFrozen(event.id)

    // Refusing here is what keeps the bucket clean. The upload goes straight to B2 and only the
    // later batch confirm charges quota atomically, so a batch that cannot fit used to be signed,
    // uploaded in full and then rejected — leaving every one of those objects orphaned in storage.
    // Weighing the whole batch means nothing is signed unless all of it fits.
    if (event.photoQuota !== null) {
      const remaining = Math.max(0, event.photoQuota - event.photosUploaded)
      if (command.batchSize > remaining) {
        throw AppException.businessRule('event.photo_quota_exceeded', false, {
          quota: event.photoQuota,
          used: event.photosUploaded,
          remaining,
        })
      }
    }

    const exists = await this.photoReadRepo.existsByEventAndFilename(
      command.eventId,
      command.fileName,
    )
    if (exists) {
      return { isDuplicate: true, url: null, objectKey: null, expiresIn: null }
    }

    const sanitizedFileName = command.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const objectKey = `events/${command.eventId}/photos/${crypto.randomUUID()}-${sanitizedFileName}`

    const result = await this.storage.getPresignedUrl({
      key: objectKey,
      contentType: command.contentType,
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    })

    return {
      isDuplicate: false,
      url: result.url,
      objectKey: result.objectKey,
      expiresIn: result.expiresIn,
    }
  }
}
