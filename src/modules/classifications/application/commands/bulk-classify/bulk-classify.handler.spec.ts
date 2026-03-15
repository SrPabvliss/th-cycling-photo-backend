import type { ICyclistWriteRepository } from '@classifications/domain/ports'
import { AppException } from '@shared/domain'
import { BulkClassifyCommand } from './bulk-classify.command'
import { BulkClassifyHandler } from './bulk-classify.handler'

describe('BulkClassifyHandler', () => {
  let handler: BulkClassifyHandler
  let writeRepo: jest.Mocked<ICyclistWriteRepository>
  let prisma: { photo: { count: jest.Mock } }

  const photoId1 = '550e8400-e29b-41d4-a716-446655440001'
  const photoId2 = '550e8400-e29b-41d4-a716-446655440002'

  beforeEach(() => {
    jest.clearAllMocks()

    writeRepo = {
      saveCyclist: jest.fn(),
      savePlateNumber: jest.fn(),
      saveColors: jest.fn(),
      deleteColorsByCyclist: jest.fn(),
      deletePlateNumberByCyclist: jest.fn(),
      deleteCyclist: jest.fn(),
      bulkClassify: jest.fn(),
    } as jest.Mocked<ICyclistWriteRepository>

    prisma = {
      photo: { count: jest.fn() },
    }

    handler = new BulkClassifyHandler(writeRepo, prisma as never)
  })

  it('should classify multiple photos and return classifiedCount', async () => {
    prisma.photo.count.mockResolvedValueOnce(2)
    writeRepo.bulkClassify.mockResolvedValueOnce(undefined)

    const command = new BulkClassifyCommand([photoId1, photoId2], 42, [
      { itemType: 'helmet', colorName: 'Red', colorHex: '#FF0000' },
    ])

    const result = await handler.execute(command)

    expect(result).toEqual({ classifiedCount: 2 })
    expect(writeRepo.bulkClassify).toHaveBeenCalledWith(
      expect.objectContaining({
        photoIds: [photoId1, photoId2],
        cyclists: expect.arrayContaining([
          expect.objectContaining({ photoId: photoId1 }),
          expect.objectContaining({ photoId: photoId2 }),
        ]),
        plateNumbers: expect.arrayContaining([
          expect.objectContaining({ number: 42 }),
          expect.objectContaining({ number: 42 }),
        ]),
        colors: expect.arrayContaining([
          expect.objectContaining({ colorName: 'Red', colorHex: '#FF0000', itemType: 'helmet' }),
        ]),
      }),
    )
  })

  it('should throw BUSINESS_RULE when some photos do not exist', async () => {
    prisma.photo.count.mockResolvedValueOnce(1)

    const command = new BulkClassifyCommand([photoId1, photoId2], null, [
      { itemType: 'clothing', colorName: 'Blue', colorHex: '#0000FF' },
    ])

    const error = await handler.execute(command).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('BUSINESS_RULE')
    expect(writeRepo.bulkClassify).not.toHaveBeenCalled()
  })

  it('should deduplicate photo IDs', async () => {
    prisma.photo.count.mockResolvedValueOnce(1)
    writeRepo.bulkClassify.mockResolvedValueOnce(undefined)

    const command = new BulkClassifyCommand([photoId1, photoId1], 100, [
      { itemType: 'bike', colorName: 'Black', colorHex: '#000000' },
    ])

    const result = await handler.execute(command)

    expect(result).toEqual({ classifiedCount: 1 })
    expect(writeRepo.bulkClassify).toHaveBeenCalledWith(
      expect.objectContaining({
        photoIds: [photoId1],
        cyclists: expect.arrayContaining([expect.objectContaining({ photoId: photoId1 })]),
      }),
    )
  })

  it('should work without plate number', async () => {
    prisma.photo.count.mockResolvedValueOnce(1)
    writeRepo.bulkClassify.mockResolvedValueOnce(undefined)

    const command = new BulkClassifyCommand([photoId1], null, [
      { itemType: 'helmet', colorName: 'White', colorHex: '#FFFFFF' },
    ])

    const result = await handler.execute(command)

    expect(result).toEqual({ classifiedCount: 1 })
    expect(writeRepo.bulkClassify).toHaveBeenCalledWith(
      expect.objectContaining({
        plateNumbers: [],
      }),
    )
  })
})
