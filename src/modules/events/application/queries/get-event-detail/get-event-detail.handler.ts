import { EventDetailProjection } from '@events/application/projections'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { GetEventDetailQuery } from './get-event-detail.query'

@QueryHandler(GetEventDetailQuery)
export class GetEventDetailHandler implements IQueryHandler<GetEventDetailQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  /** Retrieves a single event's detail, enriching with auto cover and file size. */
  async execute(query: GetEventDetailQuery): Promise<EventDetailProjection> {
    const event = await this.readRepo.getEventDetail(query.id)
    if (!event) throw AppException.notFound('Event', query.id)

    const [totalFileSize, storageKey] = await Promise.all([
      this.photoReadRepo.getTotalFileSizeByEvent(event.id),
      event.coverImageUrl
        ? Promise.resolve(null)
        : this.photoReadRepo.findFirstStorageKeyByEvent(event.id),
    ])

    event.totalFileSize = totalFileSize

    if (!event.coverImageUrl && storageKey) {
      event.coverImageUrl = this.storage.getPublicUrl(storageKey)
      event.coverImageSource = 'auto'
    }

    return event
  }
}
