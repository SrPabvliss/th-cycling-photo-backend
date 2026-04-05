import type { IParticipantWriteRepository } from '@classifications/domain/ports'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { BulkClassifyCommand } from './bulk-classify.command'
import { BulkClassifyHandler } from './bulk-classify.handler'

describe('BulkClassifyHandler', () => {
  let handler: BulkClassifyHandler
  let writeRepo: jest.Mocked<IParticipantWriteRepository>
  let photoReadRepo: jest.Mocked<IPhotoReadRepository>

  const photoId1 = '550e8400-e29b-41d4-a716-446655440001'
  const photoId2 = '550e8400-e29b-41d4-a716-446655440002'

  beforeEach(() => {
    jest.clearAllMocks()

    writeRepo = {
      saveParticipant: jest.fn(),
      saveIdentifier: jest.fn(),
      saveColors: jest.fn(),
      deleteColorsByParticipant: jest.fn(),
      deleteIdentifierByParticipant: jest.fn(),
      deleteParticipant: jest.fn(),
      bulkClassify: jest.fn(),
    } as jest.Mocked<IParticipantWriteRepository>

    photoReadRepo = {
      countByIds: jest.fn(),
    } as unknown as jest.Mocked<IPhotoReadRepository>

    handler = new BulkClassifyHandler(writeRepo, photoReadRepo)
  })

  it('should classify multiple photos and return classifiedCount', async () => {
    photoReadRepo.countByIds.mockResolvedValueOnce(2)
    writeRepo.bulkClassify.mockResolvedValueOnce(undefined)

    const command = new BulkClassifyCommand([photoId1, photoId2], '42', [
      { gearTypeId: 1, colorName: 'Red', colorHex: '#FF0000' },
    ])

    const result = await handler.execute(command)

    expect(result).toEqual({ classifiedCount: 2 })
    expect(writeRepo.bulkClassify).toHaveBeenCalledWith(
      expect.objectContaining({
        photoIds: [photoId1, photoId2],
        participants: expect.arrayContaining([
          expect.objectContaining({ photoId: photoId1 }),
          expect.objectContaining({ photoId: photoId2 }),
        ]),
        identifiers: expect.arrayContaining([
          expect.objectContaining({ value: '42' }),
          expect.objectContaining({ value: '42' }),
        ]),
        colors: expect.arrayContaining([
          expect.objectContaining({ colorName: 'Red', colorHex: '#FF0000', gearTypeId: 1 }),
        ]),
      }),
    )
  })

  it('should throw BUSINESS_RULE when some photos do not exist', async () => {
    photoReadRepo.countByIds.mockResolvedValueOnce(1)

    const command = new BulkClassifyCommand([photoId1, photoId2], null, [
      { gearTypeId: 2, colorName: 'Blue', colorHex: '#0000FF' },
    ])

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('BUSINESS_RULE')
    expect(writeRepo.bulkClassify).not.toHaveBeenCalled()
  })

  it('should deduplicate photo IDs', async () => {
    photoReadRepo.countByIds.mockResolvedValueOnce(1)
    writeRepo.bulkClassify.mockResolvedValueOnce(undefined)

    const command = new BulkClassifyCommand([photoId1, photoId1], '100', [
      { gearTypeId: 3, colorName: 'Black', colorHex: '#000000' },
    ])

    const result = await handler.execute(command)

    expect(result).toEqual({ classifiedCount: 1 })
    expect(writeRepo.bulkClassify).toHaveBeenCalledWith(
      expect.objectContaining({
        photoIds: [photoId1],
        participants: expect.arrayContaining([expect.objectContaining({ photoId: photoId1 })]),
      }),
    )
  })

  it('should work without identifier', async () => {
    photoReadRepo.countByIds.mockResolvedValueOnce(1)
    writeRepo.bulkClassify.mockResolvedValueOnce(undefined)

    const command = new BulkClassifyCommand([photoId1], null, [
      { gearTypeId: 1, colorName: 'White', colorHex: '#FFFFFF' },
    ])

    const result = await handler.execute(command)

    expect(result).toEqual({ classifiedCount: 1 })
    expect(writeRepo.bulkClassify).toHaveBeenCalledWith(
      expect.objectContaining({
        identifiers: [],
      }),
    )
  })
})
