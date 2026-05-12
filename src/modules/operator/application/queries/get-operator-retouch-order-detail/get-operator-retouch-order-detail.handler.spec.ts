import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type {
  IOperatorRetouchReadRepository,
  OperatorRetouchOrderDetailRow,
} from '../../../domain/ports'
import { GetOperatorRetouchOrderDetailHandler } from './get-operator-retouch-order-detail.handler'
import { GetOperatorRetouchOrderDetailQuery } from './get-operator-retouch-order-detail.query'

describe('GetOperatorRetouchOrderDetailHandler', () => {
  let handler: GetOperatorRetouchOrderDetailHandler
  let retouchRead: jest.Mocked<
    Pick<IOperatorRetouchReadRepository, 'findOrderDetailRow' | 'isOperatorAssigned'>
  >
  let cdn: jest.Mocked<Pick<CdnUrlBuilder, 'internalUrl'>>

  beforeEach(() => {
    retouchRead = {
      findOrderDetailRow: jest.fn(),
      isOperatorAssigned: jest.fn(),
    }
    cdn = { internalUrl: jest.fn().mockReturnValue('https://cdn.test/thumb.jpg') }
    handler = new GetOperatorRetouchOrderDetailHandler(retouchRead as never, cdn as never)
  })

  const buildRow = (): OperatorRetouchOrderDetailRow => ({
    orderId: 'order-1',
    buyerName: 'Ana Gómez',
    eventId: 'event-1',
    eventName: 'Vuelta Ciclista',
    createdAt: new Date('2024-03-10T08:00:00Z'),
    photos: [
      {
        photoId: 'photo-1',
        publicSlug: 'slug-1',
        filename: 'IMG_001.jpg',
        retouchedStorageKey: null,
      },
      {
        photoId: 'photo-2',
        publicSlug: 'slug-2',
        filename: 'IMG_002.jpg',
        retouchedStorageKey: null,
      },
    ],
  })

  it('retorna la proyección cuando la orden existe y el operador está asignado', async () => {
    retouchRead.findOrderDetailRow.mockResolvedValue(buildRow())
    retouchRead.isOperatorAssigned.mockResolvedValue(true)

    const result = await handler.execute(
      new GetOperatorRetouchOrderDetailQuery('order-1', 'operator-1'),
    )

    expect(retouchRead.findOrderDetailRow).toHaveBeenCalledWith('order-1', true)
    expect(retouchRead.isOperatorAssigned).toHaveBeenCalledWith('event-1', 'operator-1')
    expect(result.orderId).toBe('order-1')
    expect(result.buyerName).toBe('Ana Gómez')
    expect(result.eventId).toBe('event-1')
    expect(result.eventName).toBe('Vuelta Ciclista')
    expect(result.createdAt).toBe('2024-03-10T08:00:00.000Z')
    expect(result.photos).toHaveLength(2)
    expect(result.photos[0]).toMatchObject({
      photoId: 'photo-1',
      publicSlug: 'slug-1',
      filename: 'IMG_001.jpg',
      thumbnailUrl: 'https://cdn.test/thumb.jpg',
      isRetouched: false,
    })
  })

  it('lanza not-found cuando la orden no existe', async () => {
    retouchRead.findOrderDetailRow.mockResolvedValue(null)

    await expect(
      handler.execute(new GetOperatorRetouchOrderDetailQuery('order-999', 'operator-1')),
    ).rejects.toThrow()

    expect(retouchRead.isOperatorAssigned).not.toHaveBeenCalled()
  })

  it('lanza forbidden cuando el operador no está asignado al evento', async () => {
    retouchRead.findOrderDetailRow.mockResolvedValue(buildRow())
    retouchRead.isOperatorAssigned.mockResolvedValue(false)

    await expect(
      handler.execute(new GetOperatorRetouchOrderDetailQuery('order-1', 'operator-x')),
    ).rejects.toThrow()
  })
})
