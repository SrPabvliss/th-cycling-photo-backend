import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain/exceptions/app.exception'
import { BackblazeB2Adapter } from './backblaze-b2.adapter'

jest.mock('@aws-sdk/client-s3')

const mockSend = jest.fn()
;(S3Client as jest.MockedClass<typeof S3Client>).mockImplementation(
  () => ({ send: mockSend }) as unknown as S3Client,
)

function createConfigService(overrides: Record<string, unknown> = {}): ConfigService {
  const defaults: Record<string, unknown> = {
    'storage.b2.region': 'us-east-005',
    'storage.b2.bucketName': 'test-bucket',
    'storage.b2.applicationKeyId': 'test-key-id',
    'storage.b2.applicationKey': 'test-key-secret',
    'storage.cdnUrl': 'https://cdn.example.com',
  }

  const config = { ...defaults, ...overrides }

  return {
    getOrThrow: jest.fn((key: string) => {
      const value = config[key]
      if (value === undefined) throw new Error(`Missing config: ${key}`)
      return value
    }),
    get: jest.fn((key: string) => config[key]),
  } as unknown as ConfigService
}

describe('BackblazeB2Adapter', () => {
  let adapter: BackblazeB2Adapter

  beforeEach(() => {
    jest.clearAllMocks()
    adapter = new BackblazeB2Adapter(createConfigService())
  })

  describe('constructor', () => {
    it('should initialize S3Client with correct config', () => {
      expect(S3Client).toHaveBeenCalledWith({
        endpoint: 'https://s3.us-east-005.backblazeb2.com',
        region: 'us-east-005',
        credentials: {
          accessKeyId: 'test-key-id',
          secretAccessKey: 'test-key-secret',
        },
      })
    })
  })

  describe('upload', () => {
    const uploadParams = {
      buffer: Buffer.from('test-content'),
      key: 'events/abc-123/photos/def-456.jpg',
      contentType: 'image/jpeg',
    }

    it('should upload file and return key with CDN URL', async () => {
      mockSend.mockResolvedValueOnce({})

      const result = await adapter.upload(uploadParams)

      expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand))
      expect(result).toEqual({
        key: 'events/abc-123/photos/def-456.jpg',
        url: 'https://cdn.example.com/events/abc-123/photos/def-456.jpg',
      })
    })

    it('should send PutObjectCommand with correct params', async () => {
      mockSend.mockResolvedValueOnce({})

      await adapter.upload(uploadParams)

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'events/abc-123/photos/def-456.jpg',
        Body: uploadParams.buffer,
        ContentType: 'image/jpeg',
      })
    })

    it('should throw AppException.externalService on S3 error', async () => {
      mockSend.mockRejectedValueOnce(new Error('S3 upload failed'))

      const error = await adapter.upload(uploadParams).catch((e) => e)
      expect(error).toBeInstanceOf(AppException)
      expect(error.code).toBe('EXTERNAL_SERVICE')
    })
  })

  describe('getPublicUrl', () => {
    it('should return CDN URL when cdnUrl is configured', () => {
      const url = adapter.getPublicUrl('events/abc-123/photos/def-456.jpg')
      expect(url).toBe('https://cdn.example.com/events/abc-123/photos/def-456.jpg')
    })

    it('should return B2 direct URL when cdnUrl is not configured', () => {
      const adapterNoCdn = new BackblazeB2Adapter(
        createConfigService({ 'storage.cdnUrl': undefined }),
      )

      const url = adapterNoCdn.getPublicUrl('events/abc-123/photos/def-456.jpg')
      expect(url).toBe(
        'https://f005.backblazeb2.com/file/test-bucket/events/abc-123/photos/def-456.jpg',
      )
    })
  })

  describe('delete', () => {
    const key = 'events/abc-123/photos/def-456.jpg'

    it('should send DeleteObjectCommand with correct params', async () => {
      mockSend.mockResolvedValueOnce({})

      await adapter.delete(key)

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: key,
      })
    })

    it('should throw AppException.externalService on S3 error', async () => {
      mockSend.mockRejectedValueOnce(new Error('S3 delete failed'))

      const error = await adapter.delete(key).catch((e) => e)
      expect(error).toBeInstanceOf(AppException)
      expect(error.code).toBe('EXTERNAL_SERVICE')
    })
  })
})
