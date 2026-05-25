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

describe('Mark photo reviewed (e2e)', () => {
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
      await prisma.photo.deleteMany({ where: { id: { in: createdPhotoIds } } })
    }
    await prisma.event.deleteMany({ where: { id: eventId } }).catch(() => undefined)
    for (const uid of createdUserIds) {
      await prisma.userRole.deleteMany({ where: { user_id: uid } })
      await prisma.user.delete({ where: { id: uid } }).catch(() => undefined)
    }
    await app.close()
  })

  it('admin can mark a photo reviewed → 200, status=reviewed, reviewed_at recent', async () => {
    const photoId = await seedProcessedPhoto()

    const before = Date.now()
    const res = await request(app.getHttpServer())
      .post(`/api/v1/photos/${photoId}/reviewed`)
      .set('Authorization', bearer)
      .send({})
      .expect(200)
    const after = Date.now()

    expect(res.body.data).toEqual(expect.objectContaining({ photoId }))

    const photo = await prisma.photo.findUniqueOrThrow({ where: { id: photoId } })
    expect(photo.status).toBe('reviewed')
    expect(photo.reviewed_at).not.toBeNull()
    expect(photo.reviewed_at?.getTime()).toBeGreaterThanOrEqual(before - 5000)
    expect(photo.reviewed_at?.getTime()).toBeLessThanOrEqual(after + 5000)
  })

  it('idempotent: second call updates timestamp, status remains reviewed', async () => {
    const photoId = await seedProcessedPhoto()

    await request(app.getHttpServer())
      .post(`/api/v1/photos/${photoId}/reviewed`)
      .set('Authorization', bearer)
      .send({})
      .expect(200)
    const first = await prisma.photo.findUniqueOrThrow({ where: { id: photoId } })

    await new Promise((r) => setTimeout(r, 25))

    await request(app.getHttpServer())
      .post(`/api/v1/photos/${photoId}/reviewed`)
      .set('Authorization', bearer)
      .send({})
      .expect(200)
    const second = await prisma.photo.findUniqueOrThrow({ where: { id: photoId } })

    expect(second.status).toBe('reviewed')
    expect(second.reviewed_at?.getTime()).toBeGreaterThanOrEqual(first.reviewed_at!.getTime())
  })

  it('photo with status=processing → 422 BUSINESS_RULE', async () => {
    const photoId = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
    createdPhotoIds.push(photoId)
    await prisma.photo.update({ where: { id: photoId }, data: { status: 'processing' } })

    const res = await request(app.getHttpServer())
      .post(`/api/v1/photos/${photoId}/reviewed`)
      .set('Authorization', bearer)
      .send({})
      .expect(422)

    expect(res.body.error).toHaveProperty('code', 'BUSINESS_RULE')
  })

  it('without JWT → 401', async () => {
    const photoId = await seedProcessedPhoto()
    await request(app.getHttpServer())
      .post(`/api/v1/photos/${photoId}/reviewed`)
      .send({})
      .expect(401)
  })

  it('with customer role → 403', async () => {
    const photoId = await seedProcessedPhoto()
    await request(app.getHttpServer())
      .post(`/api/v1/photos/${photoId}/reviewed`)
      .set('Authorization', customerBearer)
      .send({})
      .expect(403)
  })
})
