import { AttributeSource, ColorRegion, type PrismaClient } from '@generated/prisma/client'
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

describe('Corrections endpoints (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let admin: TestAuthUser
  let customer: TestAuthUser
  let bearer: string
  let customerBearer: string
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

  const seedBib = async (photoId: string, digits = '20', confidence = 0.5) => {
    const bib = await prisma.photoBib.create({
      data: {
        photo_id: photoId,
        source: AttributeSource.ai,
        digits,
        confidence,
      },
      select: { id: true },
    })
    return bib.id
  }

  const seedColor = async (
    photoId: string,
    primary = 'rojo',
    secondary: string | null = 'blanco',
  ) => {
    const color = await prisma.photoColor.create({
      data: {
        photo_id: photoId,
        source: AttributeSource.ai,
        region: ColorRegion.helmet,
        primary_color: primary,
        secondary_color: secondary,
      },
      select: { id: true },
    })
    return color.id
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
    customer = await createAuthenticatedUser(prisma as never, jwt, 'customer')
    bearer = `Bearer ${admin.token}`
    customerBearer = `Bearer ${customer.token}`
    createdUserIds.push(admin.userId, customer.userId)

    eventId = await createEventFixture(prisma as unknown as PrismaClient)
  })

  afterAll(async () => {
    if (createdPhotoIds.length) {
      await prisma.correction.deleteMany({ where: { photo_id: { in: createdPhotoIds } } })
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

  describe('POST /photos/:photoId/bibs/:bibId/corrections', () => {
    it('admin can apply a digits correction → 201 changed=true with correctionId, DB row written', async () => {
      const photoId = await seedProcessedPhoto()
      const bibId = await seedBib(photoId, '20')

      const res = await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/bibs/${bibId}/corrections`)
        .set('Authorization', bearer)
        .send({ newValue: '25' })
        .expect(201)

      expect(res.body.data).toEqual(
        expect.objectContaining({ changed: true, correctionId: expect.any(String) }),
      )

      const rows = await prisma.correction.findMany({ where: { target_id: bibId } })
      expect(rows).toHaveLength(1)
      expect(rows[0]).toEqual(
        expect.objectContaining({
          old_value: '20',
          new_value: '25',
          field: 'digits',
          target_type: 'photo_bib',
          reviewer_id: admin.userId,
        }),
      )

      const photo = await prisma.photo.findUniqueOrThrow({ where: { id: photoId } })
      expect(photo.status).toBe('reviewed')
      expect(photo.reviewed_at).not.toBeNull()
    })

    it('same value as effective → 201 changed=false, no new correction row, photo still bumped', async () => {
      const photoId = await seedProcessedPhoto()
      const bibId = await seedBib(photoId, '20')

      const res = await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/bibs/${bibId}/corrections`)
        .set('Authorization', bearer)
        .send({ newValue: '20' })
        .expect(201)

      expect(res.body.data).toEqual(expect.objectContaining({ changed: false }))
      expect(res.body.data.correctionId).toBeUndefined()

      const rows = await prisma.correction.findMany({ where: { target_id: bibId } })
      expect(rows).toHaveLength(0)

      const photo = await prisma.photo.findUniqueOrThrow({ where: { id: photoId } })
      expect(photo.status).toBe('reviewed')
      expect(photo.reviewed_at).not.toBeNull()
    })

    it('photo with status=processing → 422 BUSINESS_RULE', async () => {
      const photoId = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
      createdPhotoIds.push(photoId)
      await prisma.photo.update({ where: { id: photoId }, data: { status: 'processing' } })
      const bibId = await seedBib(photoId, '20')

      const res = await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/bibs/${bibId}/corrections`)
        .set('Authorization', bearer)
        .send({ newValue: '25' })
        .expect(422)

      expect(res.body.error).toHaveProperty('code', 'BUSINESS_RULE')
    })

    it('bibId not belonging to the photo → 404', async () => {
      const photoA = await seedProcessedPhoto()
      const photoB = await seedProcessedPhoto()
      const orphanBibId = await seedBib(photoB, '30')

      await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoA}/bibs/${orphanBibId}/corrections`)
        .set('Authorization', bearer)
        .send({ newValue: '25' })
        .expect(404)
    })

    it('newValue not matching ^[0-9]{1,6}$ → 400 (DTO validation)', async () => {
      const photoId = await seedProcessedPhoto()
      const bibId = await seedBib(photoId, '20')

      await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/bibs/${bibId}/corrections`)
        .set('Authorization', bearer)
        .send({ newValue: 'ABC' })
        .expect(400)
    })

    it('without JWT → 401', async () => {
      const photoId = await seedProcessedPhoto()
      const bibId = await seedBib(photoId, '20')
      await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/bibs/${bibId}/corrections`)
        .send({ newValue: '25' })
        .expect(401)
    })

    it('with customer role → 403', async () => {
      const photoId = await seedProcessedPhoto()
      const bibId = await seedBib(photoId, '20')
      await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/bibs/${bibId}/corrections`)
        .set('Authorization', customerBearer)
        .send({ newValue: '25' })
        .expect(403)
    })

    it('two consecutive corrections (20 → 25 → 25): last is no-op', async () => {
      const photoId = await seedProcessedPhoto()
      const bibId = await seedBib(photoId, '20')

      const r1 = await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/bibs/${bibId}/corrections`)
        .set('Authorization', bearer)
        .send({ newValue: '25' })
        .expect(201)
      expect(r1.body.data.changed).toBe(true)

      const r2 = await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/bibs/${bibId}/corrections`)
        .set('Authorization', bearer)
        .send({ newValue: '25' })
        .expect(201)
      expect(r2.body.data.changed).toBe(false)

      const rows = await prisma.correction.findMany({ where: { target_id: bibId } })
      expect(rows).toHaveLength(1)
    })
  })

  describe('POST /photos/:photoId/colors/:colorId/corrections', () => {
    it('primary_color path → 201, correction row created', async () => {
      const photoId = await seedProcessedPhoto()
      const colorId = await seedColor(photoId, 'rojo', 'blanco')

      const res = await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/colors/${colorId}/corrections`)
        .set('Authorization', bearer)
        .send({ field: 'primary_color', newValue: 'naranja' })
        .expect(201)

      expect(res.body.data).toEqual(
        expect.objectContaining({ changed: true, correctionId: expect.any(String) }),
      )

      const rows = await prisma.correction.findMany({ where: { target_id: colorId } })
      expect(rows).toHaveLength(1)
      expect(rows[0]).toEqual(
        expect.objectContaining({
          field: 'primary_color',
          old_value: 'rojo',
          new_value: 'naranja',
          target_type: 'photo_color',
        }),
      )
    })

    it('secondary_color with null is allowed (remove secondary) → 201', async () => {
      const photoId = await seedProcessedPhoto()
      const colorId = await seedColor(photoId, 'rojo', 'blanco')

      const res = await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/colors/${colorId}/corrections`)
        .set('Authorization', bearer)
        .send({ field: 'secondary_color', newValue: null })
        .expect(201)

      expect(res.body.data.changed).toBe(true)
      const rows = await prisma.correction.findMany({ where: { target_id: colorId } })
      expect(rows[0]).toEqual(
        expect.objectContaining({
          field: 'secondary_color',
          old_value: 'blanco',
          new_value: null,
        }),
      )
    })

    it('color not belonging to the photo → 404', async () => {
      const photoA = await seedProcessedPhoto()
      const photoB = await seedProcessedPhoto()
      const colorBId = await seedColor(photoB)

      await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoA}/colors/${colorBId}/corrections`)
        .set('Authorization', bearer)
        .send({ field: 'primary_color', newValue: 'azul' })
        .expect(404)
    })

    it('invalid color value (not in palette) → 400', async () => {
      const photoId = await seedProcessedPhoto()
      const colorId = await seedColor(photoId)

      await request(app.getHttpServer())
        .post(`/api/v1/photos/${photoId}/colors/${colorId}/corrections`)
        .set('Authorization', bearer)
        .send({ field: 'primary_color', newValue: 'turquesa' })
        .expect(400)
    })
  })
})
