import { DeliveryLinkReadRepository } from './delivery-link-read.repository'

function buildRepository() {
  const findFirst = jest.fn().mockResolvedValue(null)
  const findMany = jest.fn().mockResolvedValue([])

  const prisma = {
    deliveryLink: { findFirst, findMany },
  }

  return {
    repository: new DeliveryLinkReadRepository(prisma as never),
    findFirst,
    findMany,
  }
}

describe('DeliveryLinkReadRepository.getDeliveryData', () => {
  it('resolves the delivered file per item and keeps photo id/filename intact', async () => {
    const { repository, findFirst } = buildRepository()
    findFirst.mockResolvedValue({
      token: 'token-1',
      status: 'active',
      expires_at: new Date('2026-02-01'),
      download_count: 2,
      order: {
        event: { name: 'Event 1' },
        snap_first_name: 'Jane',
        snap_last_name: 'Doe',
        items: [
          {
            delivered_as: 'original',
            photo: {
              id: 'photo-1',
              filename: 'photo-1.jpg',
              storage_key: 'original-key-1',
              file_size: BigInt(1000),
              retouched_storage_key: 'retouched-key-1',
              retouched_file_size: BigInt(2000),
            },
          },
          {
            delivered_as: 'retouched',
            photo: {
              id: 'photo-2',
              filename: 'photo-2.jpg',
              storage_key: 'original-key-2',
              file_size: BigInt(3000),
              retouched_storage_key: 'retouched-key-2',
              retouched_file_size: BigInt(4000),
            },
          },
          {
            delivered_as: null,
            photo: {
              id: 'photo-3',
              filename: 'photo-3.jpg',
              storage_key: 'original-key-3',
              file_size: BigInt(5000),
              retouched_storage_key: 'retouched-key-3',
              retouched_file_size: BigInt(6000),
            },
          },
        ],
      },
    })

    const data = await repository.getDeliveryData('token-1')

    expect(data?.photos).toEqual([
      { id: 'photo-1', filename: 'photo-1.jpg', storageKey: 'original-key-1', fileSize: 1000 },
      { id: 'photo-2', filename: 'photo-2.jpg', storageKey: 'retouched-key-2', fileSize: 4000 },
      { id: 'photo-3', filename: 'photo-3.jpg', storageKey: 'retouched-key-3', fileSize: 6000 },
    ])
    data?.photos.forEach((photo) => {
      expect(typeof photo.fileSize).toBe('number')
    })
  })
})
