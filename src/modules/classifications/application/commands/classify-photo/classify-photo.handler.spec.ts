import type { IClassificationWriteRepository } from '@classifications/domain/ports'
import { Photo } from '@photos/domain/entities'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import type { CyclistClassification } from './classify-photo.command'
import { ClassifyPhotoCommand } from './classify-photo.command'
import { ClassifyPhotoHandler } from './classify-photo.handler'

describe('ClassifyPhotoHandler', () => {
  let handler: ClassifyPhotoHandler
  let readRepo: jest.Mocked<IPhotoReadRepository>
  let classificationRepo: jest.Mocked<IClassificationWriteRepository>

  const existingPhoto = Photo.fromPersistence({
    id: '550e8400-e29b-41d4-a716-446655440000',
    eventId: '660e8400-e29b-41d4-a716-446655440000',
    filename: 'photo-001.jpg',
    storageKey: 'events/660e8400/photos/abc.jpg',
    fileSize: 1024n,
    mimeType: 'image/jpeg',
    width: null,
    height: null,
    status: 'pending',
    unclassifiedReason: null,
    capturedAt: null,
    uploadedAt: new Date(),
    processedAt: null,
  })

  const cyclistData: CyclistClassification = {
    boundingBox: { x: 100, y: 200, width: 50, height: 100 },
    confidenceScore: 0.92,
    plateNumber: { number: 42, confidenceScore: 0.95 },
    colors: [
      {
        itemType: 'jersey',
        colorName: 'red',
        colorHex: '#FF0000',
        densityPercentage: 65.5,
      },
    ],
  }

  beforeEach(() => {
    readRepo = {
      findById: jest.fn(),
      getPhotosList: jest.fn(),
      getPhotoDetail: jest.fn(),
      searchPhotos: jest.fn(),
    } as jest.Mocked<IPhotoReadRepository>

    classificationRepo = {
      saveClassification: jest.fn(),
    } as jest.Mocked<IClassificationWriteRepository>

    handler = new ClassifyPhotoHandler(readRepo, classificationRepo)
  })

  it('should classify photo and return its ID', async () => {
    readRepo.findById.mockResolvedValue(existingPhoto)
    classificationRepo.saveClassification.mockResolvedValue(undefined)

    const command = new ClassifyPhotoCommand(existingPhoto.id, [cyclistData])
    const result = await handler.execute(command)

    expect(result).toEqual({ id: existingPhoto.id })
    expect(readRepo.findById).toHaveBeenCalledWith(existingPhoto.id)
    expect(classificationRepo.saveClassification).toHaveBeenCalledTimes(1)
    expect(classificationRepo.saveClassification).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
      expect.arrayContaining([
        expect.objectContaining({
          cyclist: expect.objectContaining({ photoId: existingPhoto.id }),
          plate: expect.objectContaining({ number: 42 }),
          colors: expect.arrayContaining([expect.objectContaining({ colorName: 'red' })]),
        }),
      ]),
    )
  })

  it('should handle cyclist without plate number', async () => {
    readRepo.findById.mockResolvedValue(existingPhoto)
    classificationRepo.saveClassification.mockResolvedValue(undefined)

    const cyclistWithoutPlate: CyclistClassification = {
      boundingBox: { x: 10, y: 20, width: 30, height: 40 },
      confidenceScore: 0.85,
    }

    const command = new ClassifyPhotoCommand(existingPhoto.id, [cyclistWithoutPlate])
    const result = await handler.execute(command)

    expect(result).toEqual({ id: existingPhoto.id })
    expect(classificationRepo.saveClassification).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({
          plate: null,
          colors: [],
        }),
      ]),
    )
  })

  it('should handle multiple cyclists', async () => {
    readRepo.findById.mockResolvedValue(existingPhoto)
    classificationRepo.saveClassification.mockResolvedValue(undefined)

    const command = new ClassifyPhotoCommand(existingPhoto.id, [cyclistData, cyclistData])
    await handler.execute(command)

    const classifications = classificationRepo.saveClassification.mock.calls[0][1]
    expect(classifications).toHaveLength(2)
  })

  it('should throw 404 when photo does not exist', async () => {
    readRepo.findById.mockResolvedValue(null)

    const command = new ClassifyPhotoCommand('non-existent-id', [cyclistData])

    await expect(handler.execute(command)).rejects.toThrow(AppException)
    expect(classificationRepo.saveClassification).not.toHaveBeenCalled()
  })
})
