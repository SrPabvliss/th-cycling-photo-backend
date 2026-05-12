import type { IEventReadRepository } from '@events/domain/ports'
import { ForbiddenException } from '@nestjs/common'
import { PaginatedResult, Pagination } from '@shared/application'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type {
  IOperatorRetouchReadRepository,
  OperatorRetouchOrderRow,
} from '../../../domain/ports'
import { GetOperatorRetouchOrdersHandler } from './get-operator-retouch-orders.handler'
import { GetOperatorRetouchOrdersQuery } from './get-operator-retouch-orders.query'

describe('GetOperatorRetouchOrdersHandler', () => {
  let handler: GetOperatorRetouchOrdersHandler
  let eventRead: jest.Mocked<
    Pick<IEventReadRepository, 'getAllAssignedEventIds' | 'existsActiveEventBySlug'>
  >
  let retouchRead: jest.Mocked<
    Pick<IOperatorRetouchReadRepository, 'findOperatorRetouchOrdersPage'>
  >
  let cdn: jest.Mocked<Pick<CdnUrlBuilder, 'internalUrl'>>

  beforeEach(() => {
    eventRead = {
      getAllAssignedEventIds: jest.fn(),
      existsActiveEventBySlug: jest.fn(),
    }
    retouchRead = {
      findOperatorRetouchOrdersPage: jest.fn(),
    }
    cdn = { internalUrl: jest.fn().mockReturnValue('https://cdn.test/thumb.jpg') }
    handler = new GetOperatorRetouchOrdersHandler(
      eventRead as never,
      retouchRead as never,
      cdn as never,
    )
  })

  const baseQuery = (overrides?: {
    scope?: 'pending' | 'completed'
    eventSlug?: string | null
    pagination?: Pagination
  }) =>
    new GetOperatorRetouchOrdersQuery(
      'op-1',
      overrides?.pagination ?? new Pagination(1, 20),
      overrides?.scope ?? 'pending',
      overrides?.eventSlug ?? null,
    )

  it('returns empty PaginatedResult when operator has no assigned events', async () => {
    eventRead.getAllAssignedEventIds.mockResolvedValue([])

    const result = await handler.execute(baseQuery())

    expect(result).toBeInstanceOf(PaginatedResult)
    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
    expect(retouchRead.findOperatorRetouchOrdersPage).not.toHaveBeenCalled()
  })

  it('forwards all assigned event ids to the repository when no eventSlug filter', async () => {
    eventRead.getAllAssignedEventIds.mockResolvedValue(['active-1', 'completed-1', 'archived-1'])
    retouchRead.findOperatorRetouchOrdersPage.mockResolvedValue({ items: [], total: 0 })

    await handler.execute(baseQuery())

    expect(retouchRead.findOperatorRetouchOrdersPage).toHaveBeenCalledWith(
      ['active-1', 'completed-1', 'archived-1'],
      'pending',
      0,
      20,
    )
  })

  it('restricts query to a single event when eventSlug filter is set', async () => {
    eventRead.getAllAssignedEventIds.mockResolvedValue(['e-1', 'e-2'])
    eventRead.existsActiveEventBySlug.mockResolvedValue({ id: 'e-1', name: 'Evento 1' })
    retouchRead.findOperatorRetouchOrdersPage.mockResolvedValue({ items: [], total: 0 })

    await handler.execute(baseQuery({ eventSlug: 'evento-1' }))

    expect(retouchRead.findOperatorRetouchOrdersPage).toHaveBeenCalledWith(
      ['e-1'],
      'pending',
      0,
      20,
    )
  })

  it('throws Forbidden when eventSlug points to an unassigned event', async () => {
    eventRead.getAllAssignedEventIds.mockResolvedValue(['e-1'])
    eventRead.existsActiveEventBySlug.mockResolvedValue({ id: 'e-9', name: 'Other' })

    await expect(handler.execute(baseQuery({ eventSlug: 'other' }))).rejects.toThrow(
      ForbiddenException,
    )
  })

  it('passes scope=completed to the repository', async () => {
    eventRead.getAllAssignedEventIds.mockResolvedValue(['e-1'])
    retouchRead.findOperatorRetouchOrdersPage.mockResolvedValue({ items: [], total: 0 })

    await handler.execute(baseQuery({ scope: 'completed' }))

    expect(retouchRead.findOperatorRetouchOrdersPage).toHaveBeenCalledWith(
      ['e-1'],
      'completed',
      0,
      20,
    )
  })

  it('maps repository rows to projections preserving order', async () => {
    eventRead.getAllAssignedEventIds.mockResolvedValue(['e-1'])

    const items: OperatorRetouchOrderRow[] = [
      {
        orderId: 'order-1',
        buyerName: 'Juan Perez',
        eventId: 'e-1',
        eventName: 'Evento Test',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        pendingPhotosCount: 5,
        totalPhotosCount: 8,
        retouchedPhotosCount: 3,
        previewPhotos: [
          {
            photoId: 'photo-1',
            publicSlug: 'slug-1',
            filename: 'IMG_001.jpg',
            retouchedStorageKey: null,
          },
        ],
      },
    ]

    retouchRead.findOperatorRetouchOrdersPage.mockResolvedValue({ items, total: 1 })

    const result = await handler.execute(baseQuery())

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      orderId: 'order-1',
      pendingPhotosCount: 5,
      totalPhotosCount: 8,
      retouchedPhotosCount: 3,
    })
  })

  it('passes correct skip/take for page 2', async () => {
    eventRead.getAllAssignedEventIds.mockResolvedValue(['e-1'])
    retouchRead.findOperatorRetouchOrdersPage.mockResolvedValue({ items: [], total: 0 })

    await handler.execute(baseQuery({ pagination: new Pagination(2, 10) }))

    expect(retouchRead.findOperatorRetouchOrdersPage).toHaveBeenCalledWith(
      ['e-1'],
      'pending',
      10,
      10,
    )
  })
})
