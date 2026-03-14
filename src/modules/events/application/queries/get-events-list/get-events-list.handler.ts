import { EventListProjection } from '@events/application/projections'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import type { PaginatedResult } from '@shared/application'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { GetEventsListQuery } from './get-events-list.query'

@QueryHandler(GetEventsListQuery)
export class GetEventsListHandler implements IQueryHandler<GetEventsListQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  /** Retrieves a paginated list of events, enriching with auto cover and file sizes. */
  async execute(query: GetEventsListQuery): Promise<PaginatedResult<EventListProjection>> {
    const result = await this.readRepo.getEventsList(query.pagination, query.includeArchived)
    if (result.items.length === 0) return result

    const allEventIds = result.items.map((e) => e.id)
    const eventsWithoutCover = result.items.filter((e) => !e.coverImageUrl)

    const [fileSizes, classifiedCounts, firstPhotos] = await Promise.all([
      this.photoReadRepo.getTotalFileSizesByEventIds(allEventIds),
      this.photoReadRepo.getClassifiedCountsByEventIds(allEventIds),
      eventsWithoutCover.length > 0
        ? this.photoReadRepo.findFirstStorageKeysByEventIds(eventsWithoutCover.map((e) => e.id))
        : Promise.resolve(new Map<string, string>()),
    ])

    for (const event of result.items) {
      event.totalFileSize = fileSizes.get(event.id) ?? 0
      event.classifiedCount = classifiedCounts.get(event.id) ?? 0
    }

    for (const event of eventsWithoutCover) {
      const storageKey = firstPhotos.get(event.id)
      if (storageKey) {
        event.coverImageUrl = this.storage.getPublicUrl(storageKey)
        event.coverImageSource = 'auto'
      }
    }

    return result
  }
}
