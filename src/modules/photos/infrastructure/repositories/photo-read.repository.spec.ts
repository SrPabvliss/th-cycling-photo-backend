import type { ICorrectionRepository } from '@photos/domain/ports'
import { Pagination } from '@shared/application'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type { PrismaService } from '@shared/infrastructure'
import type { IStorageAdapter } from '@shared/storage/domain/ports/storage-adapter.port'
import { PhotoReadRepository } from './photo-read.repository'

describe('PhotoReadRepository.searchPhotos (correction-aware filters)', () => {
  let prisma: any
  let repo: PhotoReadRepository

  const cdn: Partial<CdnUrlBuilder> = {
    internalUrl: jest.fn(() => 'https://cdn.test/x'),
  }
  const storage: Partial<IStorageAdapter> = {}
  const correctionRepo: Partial<ICorrectionRepository> = {}

  const pagination = new Pagination(1, 20)

  beforeEach(() => {
    prisma = {
      photo: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest.fn(),
    }
    repo = new PhotoReadRepository(
      prisma as PrismaService,
      cdn as CdnUrlBuilder,
      storage as IStorageAdapter,
      correctionRepo as ICorrectionRepository,
    )
  })

  it('skips the pre-query when no attribute filter is provided', async () => {
    await repo.searchPhotos({ eventId: 'e-1' }, pagination)
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
    expect(prisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ id: expect.anything() }) }),
    )
  })

  it('narrows main query by ids returned from bib pre-query (corrected value)', async () => {
    // simulating: bib originally '45' corrected to '15'; searching '15' finds the photo
    prisma.$queryRaw.mockResolvedValueOnce([{ photo_id: 'p-corrected' }])

    await repo.searchPhotos({ plateNumber: '15', bibMatch: 'exact' }, pagination)

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(prisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['p-corrected'] } }) }),
    )
  })

  it('short-circuits with empty result when bib pre-query returns no ids', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([])

    const result = await repo.searchPhotos({ plateNumber: '45', bibMatch: 'exact' }, pagination)

    expect(result.total).toBe(0)
    expect(result.items).toEqual([])
    expect(prisma.photo.findMany).not.toHaveBeenCalled()
    expect(prisma.photo.count).not.toHaveBeenCalled()
  })

  it('intersects multiple attribute filters (bib AND helmet color)', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ photo_id: 'p-1' }, { photo_id: 'p-2' }])
      .mockResolvedValueOnce([{ photo_id: 'p-2' }, { photo_id: 'p-3' }])

    await repo.searchPhotos(
      { plateNumber: '15', bibMatch: 'exact', helmetColor: 'blue' },
      pagination,
    )

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2)
    expect(prisma.photo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['p-2'] } }) }),
    )
  })

  it('issues separate color pre-queries per region (clothing + bike)', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ photo_id: 'p-1' }])
      .mockResolvedValueOnce([{ photo_id: 'p-1' }])

    await repo.searchPhotos({ clothingColor: 'red', bikeColor: 'black' }, pagination)

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2)
  })
})
