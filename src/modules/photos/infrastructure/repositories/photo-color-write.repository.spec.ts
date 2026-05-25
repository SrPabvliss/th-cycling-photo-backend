import { PhotoColor } from '@classifications/domain/entities'
import { AttributeSource, ColorRegion } from '@generated/prisma/client'
import { photoDetailSelectConfig } from '../mappers/photo.mapper'
import { PhotoColorWriteRepository } from './photo-color-write.repository'

describe('PhotoColorWriteRepository', () => {
  let prisma: any
  let repo: PhotoColorWriteRepository

  beforeEach(() => {
    prisma = {
      photoColor: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    }
    repo = new PhotoColorWriteRepository(prisma)
  })

  it('findById returns null when not found', async () => {
    prisma.photoColor.findUnique.mockResolvedValue(null)
    expect(await repo.findById('x')).toBeNull()
  })

  it('findById returns slim shape with photoId and colors', async () => {
    prisma.photoColor.findUnique.mockResolvedValue({
      id: 'c-1',
      photo_id: 'p-1',
      region: ColorRegion.helmet,
      primary_color: 'red',
      secondary_color: 'blue',
    })
    expect(await repo.findById('c-1')).toEqual({
      id: 'c-1',
      photoId: 'p-1',
      region: ColorRegion.helmet,
      primaryColor: 'red',
      secondaryColor: 'blue',
    })
  })

  it('softDelete stamps deleted_at and deleted_by_id without removing the row', async () => {
    prisma.photoColor.update.mockResolvedValue({ id: 'c-1' })
    await repo.softDelete('c-1', 'r-1')
    expect(prisma.photoColor.update).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      data: expect.objectContaining({
        deleted_at: expect.any(Date),
        deleted_by_id: 'r-1',
      }),
    })
    expect(prisma.photoColor.findUnique).not.toHaveBeenCalled()
  })

  it('photoDetailSelectConfig excludes soft-deleted colors from the detail include', () => {
    expect(photoDetailSelectConfig.colors.where).toEqual({ deleted_at: null })
  })

  it('save persists manual color via create', async () => {
    const color = PhotoColor.createManual({
      photoId: 'p-1',
      region: ColorRegion.helmet,
      primaryColor: 'red',
      secondaryColor: null,
      reviewerId: 'r-1',
    })
    prisma.photoColor.create.mockResolvedValue({ id: color.id })
    await repo.save(color)
    expect(prisma.photoColor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: color.id,
        photo_id: 'p-1',
        source: AttributeSource.reviewer,
        region: ColorRegion.helmet,
        primary_color: 'red',
        secondary_color: null,
        confidence: null,
        crop_path: null,
        created_by_id: 'r-1',
      }),
    })
  })
})
