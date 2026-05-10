import type { PrismaClient } from '@generated/prisma/client'
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
import { createPhotoFixture } from './fixtures/factories/photo.factory'
import { createEventFixture } from './fixtures/factories/user.factory'

describe('Add attribute endpoints (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let admin: TestAuthUser
  let bearer: string
  let eventId: string
  const createdPhotoIds: string[] = []
  const createdUserIds: string[] = []

  const mockStorageAdapter = {
    getPresignedUrl: jest
      .fn()
      .mockResolvedValue({ url: 'https://b2/x', objectKey: 'k', expiresIn: 300 }),
    getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://b2/d'),
    delete: jest.fn().mockResolvedValue(undefined),
    upload: jest.fn().mockResolvedValue({ key: 'k', url: 'https://cdn/x' }),
    getPublicUrl: jest.fn().mockReturnValue('https://cdn/x'),
  }

  const seedProcessedPhoto = async () => {
    const id = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
    await prisma.photo.update({ where: { id }, data: { status: 'processed' } })
    createdPhotoIds.push(id)
    return id
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
    createdUserIds.push(admin.userId)
    eventId = await createEventFixture(prisma as unknown as PrismaClient)
  })

  afterAll(async () => {
    if (createdPhotoIds.length) {
      await prisma.photoBib.deleteMany({ where: { photo_id: { in: createdPhotoIds } } })
      await prisma.photoColor.deleteMany({ where: { photo_id: { in: createdPhotoIds } } })
      await prisma.photo.deleteMany({ where: { id: { in: createdPhotoIds } } })
    }
    await prisma.event.deleteMany({ where: { id: eventId } }).catch(() => undefined)
    for (const uid of createdUserIds) {
      await prisma.userRole.deleteMany({ where: { user_id: uid } })
      await prisma.user.delete({ where: { id: uid } }).catch(() => undefined)
    }
    await app.close()
  })

  describe('POST /photos/:photoId/bibs', () => {
    it('admin → 201, photo_bib row with source=reviewer, crop_path=null, created_by_id=admin', async () => {
      const photoId = await seedProcessedPhoto()

      const res = await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/bibs`)
        .set('Authorization', bearer)
        .send({ digits: '42' })
        .expect(201)

      expect(res.body.data).toEqual(expect.objectContaining({ photoId, bibId: expect.any(String) }))

      const bibs = await prisma.photoBib.findMany({ where: { photo_id: photoId } })
      expect(bibs).toHaveLength(1)
      expect(bibs[0]).toEqual(
        expect.objectContaining({
          digits: '42',
          source: 'reviewer',
          crop_path: null,
          created_by_id: admin.userId,
          status: 'read',
        }),
      )
    })

    it('accepts status=abstained explicitly', async () => {
      const photoId = await seedProcessedPhoto()
      await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/bibs`)
        .set('Authorization', bearer)
        .send({ digits: '99', status: 'abstained' })
        .expect(201)
      const bib = await prisma.photoBib.findFirstOrThrow({ where: { photo_id: photoId } })
      expect(bib.status).toBe('abstained')
    })

    it('invalid digits → 400', async () => {
      const photoId = await seedProcessedPhoto()
      await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/bibs`)
        .set('Authorization', bearer)
        .send({ digits: 'ABC' })
        .expect(400)
    })

    it('photo NOT auto-marked-reviewed (reviewed_at unchanged)', async () => {
      const photoId = await seedProcessedPhoto()
      const before = await prisma.photo.findUniqueOrThrow({ where: { id: photoId } })
      expect(before.reviewed_at).toBeNull()

      await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/bibs`)
        .set('Authorization', bearer)
        .send({ digits: '12' })
        .expect(201)

      const after = await prisma.photo.findUniqueOrThrow({ where: { id: photoId } })
      expect(after.reviewed_at).toBeNull()
      expect(after.status).toBe(before.status)
    })
  })

  describe('POST /photos/:photoId/colors', () => {
    it('admin → 201, photo_color row with source=reviewer', async () => {
      const photoId = await seedProcessedPhoto()
      const res = await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/colors`)
        .set('Authorization', bearer)
        .send({ region: 'helmet', primaryColor: 'azul', secondaryColor: 'blanco' })
        .expect(201)

      expect(res.body.data).toEqual(
        expect.objectContaining({ photoId, colorId: expect.any(String) }),
      )

      const colors = await prisma.photoColor.findMany({ where: { photo_id: photoId } })
      expect(colors).toHaveLength(1)
      expect(colors[0]).toEqual(
        expect.objectContaining({
          region: 'helmet',
          primary_color: 'azul',
          secondary_color: 'blanco',
          source: 'reviewer',
          created_by_id: admin.userId,
        }),
      )
    })

    it('secondaryColor=null path is allowed → 201', async () => {
      const photoId = await seedProcessedPhoto()
      await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/colors`)
        .set('Authorization', bearer)
        .send({ region: 'cyclist_clothes', primaryColor: 'rojo', secondaryColor: null })
        .expect(201)
      const color = await prisma.photoColor.findFirstOrThrow({ where: { photo_id: photoId } })
      expect(color.secondary_color).toBeNull()
    })

    it('invalid region → 400', async () => {
      const photoId = await seedProcessedPhoto()
      await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/colors`)
        .set('Authorization', bearer)
        .send({ region: 'shoes', primaryColor: 'rojo' })
        .expect(400)
    })

    it('invalid color (not in palette) → 400', async () => {
      const photoId = await seedProcessedPhoto()
      await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/colors`)
        .set('Authorization', bearer)
        .send({ region: 'helmet', primaryColor: 'turquesa' })
        .expect(400)
    })
  })
})
