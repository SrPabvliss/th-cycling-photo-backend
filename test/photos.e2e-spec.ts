import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { GlobalExceptionFilter } from '../src/shared/http/filters/global-exception.filter'
import { ResponseInterceptor } from '../src/shared/http/interceptors/response.interceptor'
import { PrismaService } from '../src/shared/infrastructure'
import { STORAGE_ADAPTER } from '../src/shared/storage/domain/ports/storage-adapter.port'

describe('Photos Module (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let testEventId: string

  const mockStorageAdapter = {
    upload: jest.fn().mockResolvedValue({
      key: 'events/test/photos/mock.jpg',
      url: 'https://cdn.test.com/events/test/photos/mock.jpg',
    }),
    getPublicUrl: jest.fn().mockReturnValue('https://cdn.test.com/events/test/photos/mock.jpg'),
    delete: jest.fn().mockResolvedValue(undefined),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(STORAGE_ADAPTER)
      .useValue(mockStorageAdapter)
      .compile()

    app = moduleFixture.createNestApplication()

    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    app.useGlobalFilters(new GlobalExceptionFilter())

    const reflector = app.get(Reflector)
    app.useGlobalInterceptors(new ResponseInterceptor(reflector))

    await app.init()

    prisma = moduleFixture.get(PrismaService)

    // Create a test event for photo uploads
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)

    const event = await prisma.event.create({
      data: {
        name: 'E2E Photos Test Event',
        event_date: futureDate,
      },
    })
    testEventId = event.id
  })

  afterAll(async () => {
    // Clean up test data respecting FK order
    await prisma.equipmentColor.deleteMany()
    await prisma.plateNumber.deleteMany()
    await prisma.detectedCyclist.deleteMany()
    await prisma.photo.deleteMany()
    await prisma.event.deleteMany()
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // --- Happy path: upload → list → detail → classify → search ---

  describe('Happy path workflow', () => {
    let uploadedPhotoId: string

    it('POST /api/v1/events/:eventId/photos — should upload a photo', async () => {
      const fakeJpeg = Buffer.alloc(1024, 0xff)

      const response = await request(app.getHttpServer())
        .post(`/api/v1/events/${testEventId}/photos`)
        .attach('photos', fakeJpeg, {
          filename: 'race-photo-001.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0]).toHaveProperty('id')
      expect(typeof response.body.data[0].id).toBe('string')
      uploadedPhotoId = response.body.data[0].id

      expect(mockStorageAdapter.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: expect.any(Buffer),
          contentType: 'image/jpeg',
          key: expect.stringContaining(`events/${testEventId}/photos/`),
        }),
      )
    })

    it('POST /api/v1/events/:eventId/photos — should upload multiple photos', async () => {
      const photo1 = Buffer.alloc(512, 0xfe)
      const photo2 = Buffer.alloc(512, 0xfd)

      const response = await request(app.getHttpServer())
        .post(`/api/v1/events/${testEventId}/photos`)
        .attach('photos', photo1, {
          filename: 'race-photo-002.png',
          contentType: 'image/png',
        })
        .attach('photos', photo2, {
          filename: 'race-photo-003.webp',
          contentType: 'image/webp',
        })
        .expect(201)

      expect(response.body.data).toHaveLength(2)
      expect(mockStorageAdapter.upload).toHaveBeenCalledTimes(2)
    })

    it('GET /api/v1/events/:eventId/photos — should list uploaded photos', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/events/${testEventId}/photos`)
        .expect(200)

      expect(response.body.data).toHaveLength(3)
      expect(response.body.data[0]).toHaveProperty('id')
      expect(response.body.data[0]).toHaveProperty('eventId', testEventId)
      expect(response.body.data[0]).toHaveProperty('status', 'pending')
      expect(response.body.data[0]).toHaveProperty('filename')
      expect(response.body.data[0]).toHaveProperty('storageKey')
      expect(response.body.data[0]).toHaveProperty('uploadedAt')
    })

    it('GET /api/v1/events/:eventId/photos?page=1&limit=2 — should paginate', async () => {
      const page1 = await request(app.getHttpServer())
        .get(`/api/v1/events/${testEventId}/photos`)
        .query({ page: 1, limit: 2 })
        .expect(200)

      const page2 = await request(app.getHttpServer())
        .get(`/api/v1/events/${testEventId}/photos`)
        .query({ page: 2, limit: 2 })
        .expect(200)

      expect(page1.body.data).toHaveLength(2)
      expect(page2.body.data).toHaveLength(1)
    })

    it('GET /api/v1/photos/:id — should get photo detail', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/photos/${uploadedPhotoId}`)
        .expect(200)

      const photo = response.body.data
      expect(photo).toHaveProperty('id', uploadedPhotoId)
      expect(photo).toHaveProperty('eventId', testEventId)
      expect(photo).toHaveProperty('filename', 'race-photo-001.jpg')
      expect(photo).toHaveProperty('mimeType', 'image/jpeg')
      expect(photo).toHaveProperty('status', 'pending')
      expect(photo).toHaveProperty('detectedCyclists')
      expect(photo.detectedCyclists).toEqual([])
    })

    it('PATCH /api/v1/photos/:id/classify — should classify photo with cyclist data', async () => {
      const classifyBody = {
        cyclists: [
          {
            boundingBox: { x: 10, y: 20, width: 100, height: 200 },
            confidenceScore: 0.95,
            plateNumber: { number: 42, confidenceScore: 0.88 },
            colors: [
              {
                itemType: 'jersey',
                colorName: 'Red',
                colorHex: '#FF0000',
                densityPercentage: 65.5,
              },
            ],
          },
        ],
      }

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/photos/${uploadedPhotoId}/classify`)
        .send(classifyBody)
        .expect(200)

      expect(response.body.data).toHaveProperty('id', uploadedPhotoId)
    })

    it('GET /api/v1/photos/:id — should include classification data after classify', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/photos/${uploadedPhotoId}`)
        .expect(200)

      const photo = response.body.data
      expect(photo.status).toBe('completed')
      expect(photo.processedAt).not.toBeNull()
      expect(photo.detectedCyclists).toHaveLength(1)

      const cyclist = photo.detectedCyclists[0]
      expect(cyclist).toHaveProperty('confidenceScore', 0.95)
      expect(cyclist).toHaveProperty('boundingBox')
      expect(cyclist.plateNumber).toHaveProperty('number', 42)
      expect(cyclist.equipmentColors).toHaveLength(1)
      expect(cyclist.equipmentColors[0]).toHaveProperty('itemType', 'jersey')
      expect(cyclist.equipmentColors[0]).toHaveProperty('colorName', 'Red')
    })

    it('GET /api/v1/photos/search?plateNumber=42 — should find photo by plate number', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/photos/search')
        .query({ plateNumber: 42 })
        .expect(200)

      expect(response.body.data.length).toBeGreaterThanOrEqual(1)

      const found = response.body.data.find((p: { id: string }) => p.id === uploadedPhotoId)
      expect(found).toBeDefined()
      expect(found.status).toBe('completed')
    })

    it('GET /api/v1/photos/search?status=completed — should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/photos/search')
        .query({ status: 'completed', eventId: testEventId })
        .expect(200)

      expect(response.body.data.length).toBeGreaterThanOrEqual(1)
      for (const photo of response.body.data) {
        expect(photo.status).toBe('completed')
      }
    })
  })

  // --- Validation tests ---

  describe('Validation', () => {
    it('should reject non-image file types (GIF)', async () => {
      const fakeGif = Buffer.from('GIF89a')

      await request(app.getHttpServer())
        .post(`/api/v1/events/${testEventId}/photos`)
        .attach('photos', fakeGif, {
          filename: 'animation.gif',
          contentType: 'image/gif',
        })
        .expect(400)
    })

    it('should return 404 when uploading to non-existent event', async () => {
      const fakeJpeg = Buffer.alloc(64, 0xff)
      const nonExistentId = '00000000-0000-0000-0000-000000000000'

      const response = await request(app.getHttpServer())
        .post(`/api/v1/events/${nonExistentId}/photos`)
        .attach('photos', fakeJpeg, {
          filename: 'orphan.jpg',
          contentType: 'image/jpeg',
        })
        .expect(404)

      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND')
    })

    it('should reject classify with invalid body (missing required fields)', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/photos/00000000-0000-0000-0000-000000000000/classify')
        .send({ cyclists: [{ invalidField: true }] })
        .expect(400)

      expect(response.body.error).toHaveProperty('code', 'VALIDATION_FAILED')
    })

    it('should reject classify with out-of-range confidence score', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/photos/00000000-0000-0000-0000-000000000000/classify')
        .send({
          cyclists: [
            {
              boundingBox: { x: 0, y: 0, width: 10, height: 10 },
              confidenceScore: 1.5,
            },
          ],
        })
        .expect(400)
    })

    it('should reject classify with invalid equipment item type', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/photos/00000000-0000-0000-0000-000000000000/classify')
        .send({
          cyclists: [
            {
              boundingBox: { x: 0, y: 0, width: 10, height: 10 },
              confidenceScore: 0.9,
              colors: [
                {
                  itemType: 'shoes',
                  colorName: 'Blue',
                  colorHex: '#0000FF',
                  densityPercentage: 50,
                },
              ],
            },
          ],
        })
        .expect(400)
    })
  })

  // --- Edge cases ---

  describe('Edge cases', () => {
    it('should return empty list for event with no photos', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const emptyEvent = await prisma.event.create({
        data: { name: 'Empty Event', event_date: futureDate },
      })

      const response = await request(app.getHttpServer())
        .get(`/api/v1/events/${emptyEvent.id}/photos`)
        .expect(200)

      expect(response.body.data).toEqual([])
    })

    it('should return 404 for non-existent photo detail', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/photos/00000000-0000-0000-0000-000000000000')
        .expect(404)

      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND')
    })

    it('should return empty results for search with no matches', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/photos/search')
        .query({ plateNumber: 999 })
        .expect(200)

      expect(response.body.data).toEqual([])
    })

    it('should return 404 when classifying non-existent photo', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/photos/00000000-0000-0000-0000-000000000000/classify')
        .send({
          cyclists: [
            {
              boundingBox: { x: 0, y: 0, width: 10, height: 10 },
              confidenceScore: 0.9,
            },
          ],
        })
        .expect(404)

      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND')
    })
  })

  // --- Response envelope structure ---

  describe('Response envelope', () => {
    it('should wrap success response in { data, meta } envelope', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/events/${testEventId}/photos`)
        .expect(200)

      expect(response.body).toHaveProperty('data')
      expect(response.body).toHaveProperty('meta')
      expect(response.body.meta).toHaveProperty('requestId')
      expect(response.body.meta).toHaveProperty('timestamp')
    })

    it('should wrap error response in { error, meta } envelope', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/photos/00000000-0000-0000-0000-000000000000')
        .expect(404)

      expect(response.body).toHaveProperty('error')
      expect(response.body).toHaveProperty('meta')
      expect(response.body.error).toHaveProperty('code')
      expect(response.body.error).toHaveProperty('message')
      expect(response.body.meta).toHaveProperty('requestId')
    })
  })
})
