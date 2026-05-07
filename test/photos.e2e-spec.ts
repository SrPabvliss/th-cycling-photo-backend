import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { GlobalExceptionFilter } from '../src/shared/http/filters/global-exception.filter'
import { ResponseInterceptor } from '../src/shared/http/interceptors/response.interceptor'
import { PrismaService } from '../src/shared/infrastructure'
import { STORAGE_ADAPTER } from '../src/shared/storage/domain/ports/storage-adapter.port'
import { createAuthenticatedUser, type TestAuthUser } from './fixtures/factories/auth.factory'

describe('Photos Module (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let testEventId: string
  let admin: TestAuthUser
  let bearer: string

  const mockStorageAdapter = {
    getPresignedUrl: jest.fn(async ({ key }: { key: string }) => ({
      url: `https://b2.test/presigned/${key}?signed=1`,
      objectKey: key,
      expiresIn: 300,
    })),
    getPresignedDownloadUrl: jest.fn(async () => 'https://b2.test/download/mock'),
    delete: jest.fn().mockResolvedValue(undefined),
    upload: jest.fn().mockResolvedValue({
      key: 'events/test/photos/mock.jpg',
      url: 'https://cdn.test.com/events/test/photos/mock.jpg',
    }),
    getPublicUrl: jest.fn().mockReturnValue('https://cdn.test.com/events/test/photos/mock.jpg'),
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
    const jwt = moduleFixture.get(JwtService)

    admin = await createAuthenticatedUser(prisma as never, jwt, 'admin')
    bearer = `Bearer ${admin.token}`

    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)

    const eventType = await prisma.eventType.upsert({
      where: { name: 'road_race' },
      update: {},
      create: { name: 'road_race' },
    })

    const event = await prisma.event.create({
      data: {
        name: 'E2E Photos Test Event',
        slug: `e2e-photos-${Date.now()}`,
        event_date: futureDate,
        event_type_id: eventType.id,
      },
    })
    testEventId = event.id
  })

  afterAll(async () => {
    await prisma.photo.deleteMany({ where: { event_id: testEventId } })
    await prisma.event.deleteMany({ where: { id: testEventId } })
    await prisma.userRole.deleteMany({ where: { user_id: admin.userId } })
    await prisma.user.delete({ where: { id: admin.userId } }).catch(() => undefined)
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // --- Upload flow: presigned-url → confirm-batch → list → detail ---

  describe('Upload + retrieval workflow', () => {
    let confirmedPhotoId: string
    const fileName = `race-${Date.now()}-001.jpg`

    it('POST /events/:eventId/photos/presigned-url — should return signed URL', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/events/${testEventId}/photos/presigned-url`)
        .set('Authorization', bearer)
        .send({ fileName, contentType: 'image/jpeg' })
        .expect(201)

      expect(response.body.data).toMatchObject({
        isDuplicate: false,
        expiresIn: 300,
      })
      expect(response.body.data.url).toContain('https://b2.test/presigned/')
      expect(response.body.data.objectKey).toContain(`events/${testEventId}/photos/`)
      expect(mockStorageAdapter.getPresignedUrl).toHaveBeenCalledTimes(1)
    })

    it('POST /events/:eventId/photos/confirm-batch — should create photo records', async () => {
      const objectKey = `events/${testEventId}/photos/test-${Date.now()}-${fileName}`

      const response = await request(app.getHttpServer())
        .post(`/api/v1/events/${testEventId}/photos/confirm-batch`)
        .set('Authorization', bearer)
        .send({
          photos: [{ fileName, fileSize: 4096, objectKey, contentType: 'image/jpeg' }],
        })
        .expect(201)

      expect(response.body.data).toHaveProperty('confirmed', 1)
    })

    it('GET /events/:eventId/photos — should list confirmed photos', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/events/${testEventId}/photos`)
        .set('Authorization', bearer)
        .expect(200)

      expect(response.body.data.length).toBeGreaterThanOrEqual(1)
      const found = response.body.data.find((p: { filename: string }) => p.filename === fileName)
      expect(found).toBeDefined()
      confirmedPhotoId = found.id
      expect(found).toHaveProperty('id')
      expect(found).toHaveProperty('filename', fileName)
      // Status may be pending|processing|failed depending on async classification race.
      expect(['pending', 'processing', 'processed', 'failed']).toContain(found.status)
    })

    it('GET /photos/:id — should return photo detail', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/photos/${confirmedPhotoId}`)
        .set('Authorization', bearer)
        .expect(200)

      expect(response.body.data).toHaveProperty('id', confirmedPhotoId)
      expect(response.body.data).toHaveProperty('mimeType', 'image/jpeg')
      expect(['pending', 'processing', 'processed', 'failed']).toContain(response.body.data.status)
    })
  })

  // --- Validation tests ---

  describe('Validation', () => {
    it('POST presigned-url with invalid contentType should reject', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/events/${testEventId}/photos/presigned-url`)
        .set('Authorization', bearer)
        .send({ fileName: 'animation.gif', contentType: 'image/gif' })
        .expect(400)
    })

    it('POST presigned-url on non-existent event returns 404', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/events/00000000-0000-0000-0000-000000000000/photos/presigned-url')
        .set('Authorization', bearer)
        .send({ fileName: 'orphan.jpg', contentType: 'image/jpeg' })
        .expect(404)

      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND')
    })

    it('GET endpoints reject unauthenticated requests', async () => {
      await request(app.getHttpServer()).get(`/api/v1/events/${testEventId}/photos`).expect(401)
    })
  })

  // --- Edge cases ---

  describe('Edge cases', () => {
    it('GET /events/:id/photos returns empty list for event with no photos', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)

      const eventType = await prisma.eventType.findFirst({ where: { name: 'road_race' } })
      const emptyEvent = await prisma.event.create({
        data: {
          name: 'Empty Event',
          slug: `empty-event-${Date.now()}`,
          event_date: futureDate,
          event_type_id: eventType!.id,
        },
      })

      try {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/events/${emptyEvent.id}/photos`)
          .set('Authorization', bearer)
          .expect(200)

        expect(response.body.data).toEqual([])
      } finally {
        await prisma.event.delete({ where: { id: emptyEvent.id } })
      }
    })

    it('GET /photos/:id returns 404 for non-existent photo', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/photos/00000000-0000-0000-0000-000000000000')
        .set('Authorization', bearer)
        .expect(404)

      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND')
    })

    it('GET /photos/search returns empty for no matches', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/photos/search')
        .set('Authorization', bearer)
        .query({ plateNumber: 999 })
        .expect(200)

      expect(response.body.data).toEqual([])
    })
  })

  // --- Response envelope structure ---

  describe('Response envelope', () => {
    it('wraps success in { data, meta } envelope', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/events/${testEventId}/photos`)
        .set('Authorization', bearer)
        .expect(200)

      expect(response.body).toHaveProperty('data')
      expect(response.body).toHaveProperty('meta')
      expect(response.body.meta).toHaveProperty('requestId')
      expect(response.body.meta).toHaveProperty('timestamp')
    })

    it('wraps error in { error, meta } envelope', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/photos/00000000-0000-0000-0000-000000000000')
        .set('Authorization', bearer)
        .expect(404)

      expect(response.body).toHaveProperty('error')
      expect(response.body).toHaveProperty('meta')
      expect(response.body.error).toHaveProperty('code')
      expect(response.body.error).toHaveProperty('message')
      expect(response.body.meta).toHaveProperty('requestId')
    })
  })
})
