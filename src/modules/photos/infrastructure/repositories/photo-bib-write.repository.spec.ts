import { PhotoBib } from '@classifications/domain/entities'
import { AttributeSource, BibReadingStatus } from '@generated/prisma/client'
import { PhotoBibWriteRepository } from './photo-bib-write.repository'

describe('PhotoBibWriteRepository', () => {
  let prisma: any
  let repo: PhotoBibWriteRepository

  beforeEach(() => {
    prisma = {
      photoBib: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    }
    repo = new PhotoBibWriteRepository(prisma)
  })

  it('findById returns null when not found', async () => {
    prisma.photoBib.findUnique.mockResolvedValue(null)
    expect(await repo.findById('x')).toBeNull()
  })

  it('findById returns slim shape with photoId and digits', async () => {
    prisma.photoBib.findUnique.mockResolvedValue({
      id: 'b-1',
      photo_id: 'p-1',
      digits: '42',
    })
    expect(await repo.findById('b-1')).toEqual({
      id: 'b-1',
      photoId: 'p-1',
      digits: '42',
    })
  })

  it('save persists manual bib via create', async () => {
    const bib = PhotoBib.createManual({
      photoId: 'p-1',
      digits: '7',
      reviewerId: 'r-1',
    })
    prisma.photoBib.create.mockResolvedValue({ id: bib.id })
    await repo.save(bib)
    expect(prisma.photoBib.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: bib.id,
        photo_id: 'p-1',
        source: AttributeSource.reviewer,
        digits: '7',
        status: BibReadingStatus.read,
        crop_path: null,
        confidence: null,
        created_by_id: 'r-1',
      }),
    })
  })
})
