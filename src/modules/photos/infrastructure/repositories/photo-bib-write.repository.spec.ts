import { PhotoBib } from '@classifications/domain/entities'
import { AttributeSource, BibReadingStatus } from '@generated/prisma/client'
import { photoDetailSelectConfig } from '../mappers/photo.mapper'
import { PhotoBibWriteRepository } from './photo-bib-write.repository'

describe('PhotoBibWriteRepository', () => {
  let prisma: any
  let repo: PhotoBibWriteRepository

  beforeEach(() => {
    prisma = {
      photoBib: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
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

  it('softDelete stamps deleted_at and deleted_by_id without removing the row', async () => {
    prisma.photoBib.update.mockResolvedValue({ id: 'b-1' })
    await repo.softDelete('b-1', 'r-1')
    expect(prisma.photoBib.update).toHaveBeenCalledWith({
      where: { id: 'b-1' },
      data: expect.objectContaining({
        deleted_at: expect.any(Date),
        deleted_by_id: 'r-1',
      }),
    })
    // The row still exists (update, not delete) and remains queryable by id.
    expect(prisma.photoBib.findUnique).not.toHaveBeenCalled()
  })

  it('photoDetailSelectConfig excludes soft-deleted bibs from the detail include', () => {
    expect(photoDetailSelectConfig.bibs.where).toEqual({ deleted_at: null })
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
