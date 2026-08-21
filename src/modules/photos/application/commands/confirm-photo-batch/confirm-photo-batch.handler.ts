import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { InjectQueue } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { Photo } from '@photos/domain/entities'
import { type IPhotoWriteRepository, PHOTO_WRITE_REPOSITORY } from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { type IKvStorageAdapter, KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import type { Queue } from 'bullmq'
import type { ConfirmBatchProjection } from '../../projections'
import { ConfirmPhotoBatchCommand } from './confirm-photo-batch.command'

@CommandHandler(ConfirmPhotoBatchCommand)
export class ConfirmPhotoBatchHandler implements ICommandHandler<ConfirmPhotoBatchCommand> {
  private readonly logger = new Logger(ConfirmPhotoBatchHandler.name)

  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(PHOTO_WRITE_REPOSITORY) private readonly photoWriteRepo: IPhotoWriteRepository,
    @Inject(KV_STORAGE_ADAPTER) private readonly kvStorage: IKvStorageAdapter,
    @InjectQueue('embedding-generation') private readonly embeddingQueue: Queue,
    @InjectQueue('photo-classification') private readonly classificationQueue: Queue,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Validates event, checks objectKey prefixes, and batch-inserts photo metadata. See
   * `GeneratePresignedUrlHandler` for why the boundary check uses `scope.includesEvent()`.
   */
  async execute(command: ConfirmPhotoBatchCommand): Promise<ConfirmBatchProjection> {
    if (!command.audit) {
      throw AppException.internal('confirm_photo_batch.missing_audit_context')
    }
    const scope = await this.authz.resolveEventScope(command.audit.userId)
    const event = await this.eventReadRepo.findById(command.eventId)
    if (!event || !scope.includesEvent(event)) {
      throw AppException.notFound('Event', command.eventId)
    }
    await this.authz.assert(command.audit.userId, 'photo.upload', event.id)

    const expectedPrefix = `events/${command.eventId}/`
    for (const item of command.photos) {
      if (!item.objectKey.startsWith(expectedPrefix)) {
        throw AppException.businessRule('photo.invalid_object_key_prefix')
      }
    }

    const photos = command.photos.map((item) => {
      const photo = Photo.create({
        eventId: command.eventId,
        filename: item.fileName,
        storageKey: item.objectKey,
        fileSize: BigInt(item.fileSize),
        mimeType: item.contentType,
        photoCategoryId: command.photoCategoryId ?? null,
      })
      if (command.audit) photo.setCreatedBy(command.audit.userId)
      return photo
    })

    const confirmed = await this.prisma.$transaction(async (tx) => {
      // Insert first, then charge the rows actually written — skipDuplicates
      // means a retried batch must not burn quota it never used.
      const inserted = await this.photoWriteRepo.saveMany(photos, tx)
      if (inserted === 0) return 0

      const claimed = await this.photoWriteRepo.claimPhotoQuota(command.eventId, inserted, tx)
      if (!claimed) {
        const { photo_quota: quota, photos_uploaded: used } = await tx.event.findUniqueOrThrow({
          where: { id: command.eventId },
          select: { photo_quota: true, photos_uploaded: true },
        })
        throw AppException.businessRule('event.photo_quota_exceeded', false, {
          quota,
          used,
          remaining: Math.max(0, (quota ?? 0) - used),
        })
      }

      return inserted
    })

    // Register slug→path mappings in Workers KV for CDN resolution
    const kvEntries = photos.map((photo) => ({
      key: photo.publicSlug,
      value: photo.storageKey,
    }))
    await this.kvStorage.writeBulk(kvEntries).catch((err) => {
      this.logger.error(
        'Failed to write KV mappings — photos saved but CDN slugs not registered',
        err,
      )
    })

    await this.embeddingQueue.addBulk(
      photos.map((photo) => ({
        name: 'generate-embedding',
        data: { photoId: photo.id },
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      })),
    )
    this.logger.log(`Enqueued ${photos.length} embedding generation jobs`)

    await this.classificationQueue.addBulk(
      photos.map((photo) => ({
        name: 'classify-photo',
        data: { photoId: photo.id },
        opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      })),
    )
    this.logger.log(`Enqueued ${photos.length} photo classification jobs`)

    return { confirmed }
  }
}
