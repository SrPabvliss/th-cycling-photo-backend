import type { EventBriefProjection } from '@events/application/projections'
import type { IEventReadRepository } from '@events/domain/ports'
import { ForbiddenException } from '@nestjs/common'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { PaginatedResult, Pagination } from '@shared/application'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { GetOperatorReviewQueueHandler } from './get-review-queue.handler'
import { GetOperatorReviewQueueQuery } from './get-review-queue.query'

describe('GetOperatorReviewQueueHandler', () => {
  let handler: GetOperatorReviewQueueHandler
  let eventRead: jest.Mocked<
    Pick<
      IEventReadRepository,
      'getAssignedEventIdsByStatus' | 'getEventBriefsByIds' | 'existsActiveEventBySlug'
    >
  >
  let photoRead: jest.Mocked<Pick<IPhotoReadRepository, 'getReviewQueueByEventIds'>>
  let cdn: jest.Mocked<Pick<CdnUrlBuilder, 'internalUrl'>>

  beforeEach(() => {
    eventRead = {
      getAssignedEventIdsByStatus: jest.fn(),
      getEventBriefsByIds: jest.fn(),
      existsActiveEventBySlug: jest.fn(),
    }
    photoRead = { getReviewQueueByEventIds: jest.fn() }
    cdn = { internalUrl: jest.fn().mockReturnValue('https://cdn.test/thumb.jpg') }
    handler = new GetOperatorReviewQueueHandler(
      eventRead as never,
      photoRead as never,
      cdn as never,
    )
  })

  it('returns empty when operator has no assigned active events', async () => {
    eventRead.getAssignedEventIdsByStatus.mockResolvedValue([])
    const result = await handler.execute(
      new GetOperatorReviewQueueQuery('op-1', new Pagination(1, 20), 'pending', null),
    )
    expect(result).toBeInstanceOf(PaginatedResult)
    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
    expect(photoRead.getReviewQueueByEventIds).not.toHaveBeenCalled()
  })

  it('uses all assigned events when eventSlug is null', async () => {
    eventRead.getAssignedEventIdsByStatus.mockResolvedValue(['e-1', 'e-2'])
    photoRead.getReviewQueueByEventIds.mockResolvedValue({ items: [], total: 0 })
    eventRead.getEventBriefsByIds.mockResolvedValue([])

    await handler.execute(
      new GetOperatorReviewQueueQuery('op-1', new Pagination(1, 20), 'pending', null),
    )

    expect(photoRead.getReviewQueueByEventIds).toHaveBeenCalledWith({
      eventIds: ['e-1', 'e-2'],
      status: 'pending',
      limit: 20,
      offset: 0,
    })
  })

  it('rejects with ForbiddenException when eventSlug is not in assigned events', async () => {
    eventRead.getAssignedEventIdsByStatus.mockResolvedValue(['e-1'])
    eventRead.existsActiveEventBySlug.mockResolvedValue({ id: 'e-2', name: 'Otro' })

    await expect(
      handler.execute(
        new GetOperatorReviewQueueQuery('op-1', new Pagination(1, 20), 'pending', 'evento-no-mio'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('restricts to a single eventId when eventSlug is assigned', async () => {
    eventRead.getAssignedEventIdsByStatus.mockResolvedValue(['e-1', 'e-2'])
    eventRead.existsActiveEventBySlug.mockResolvedValue({ id: 'e-1', name: 'Evento Uno' })
    photoRead.getReviewQueueByEventIds.mockResolvedValue({ items: [], total: 0 })
    eventRead.getEventBriefsByIds.mockResolvedValue([])

    await handler.execute(
      new GetOperatorReviewQueueQuery('op-1', new Pagination(1, 20), 'pending', 'evento-uno'),
    )

    expect(photoRead.getReviewQueueByEventIds).toHaveBeenCalledWith({
      eventIds: ['e-1'],
      status: 'pending',
      limit: 20,
      offset: 0,
    })
  })

  it('composes item shape with event metadata and thumbnail url', async () => {
    eventRead.getAssignedEventIdsByStatus.mockResolvedValue(['e-1'])
    photoRead.getReviewQueueByEventIds.mockResolvedValue({
      items: [
        {
          id: 'p-1',
          publicSlug: 'slug-1',
          filename: 'IMG_001.jpg',
          status: 'processed' as never,
          reviewedAt: null,
          minBibConfidence: 0.42,
          bibsCount: 2,
          colorsCount: 3,
          eventId: 'e-1',
        },
      ],
      total: 1,
    })
    const brief: EventBriefProjection = { id: 'e-1', slug: 'evento-uno', name: 'Evento Uno' }
    eventRead.getEventBriefsByIds.mockResolvedValue([brief])

    const result = await handler.execute(
      new GetOperatorReviewQueueQuery('op-1', new Pagination(1, 20), 'pending', null),
    )

    expect(eventRead.getEventBriefsByIds).toHaveBeenCalledWith(['e-1'])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'p-1',
      publicSlug: 'slug-1',
      filename: 'IMG_001.jpg',
      thumbnailUrl: 'https://cdn.test/thumb.jpg',
      reviewedAt: null,
      minBibConfidence: 0.42,
      bibsCount: 2,
      colorsCount: 3,
      event: { id: 'e-1', slug: 'evento-uno', name: 'Evento Uno' },
    })
  })
})
