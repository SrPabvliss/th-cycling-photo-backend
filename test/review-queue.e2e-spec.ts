import { AttributeSource, type PrismaClient } from '@generated/prisma/client'
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

describe('Review queue (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let admin: TestAuthUser
  let customer: TestAuthUser
  let bearer: string
  let customerBearer: string
  let eventId: string
  let eventSlug: string
  let photoA: string
  let photoB: string
  let photoC: string
  let photoD: string
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
    const ev = await prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { slug: true },
    })
    eventSlug = ev.slug

    // Photo A: no bibs, status=processed (uploaded earliest)
    photoA = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
    await prisma.photo.update({
      where: { id: photoA },
      data: { status: 'processed', uploaded_at: new Date('2026-01-01T00:00:00Z') },
    })

    // Photo B: 1 bib confidence 0.30, status=processed
    photoB = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
    await prisma.photo.update({
      where: { id: photoB },
      data: { status: 'processed', uploaded_at: new Date('2026-01-02T00:00:00Z') },
    })
    await prisma.photoBib.create({
      data: { photo_id: photoB, source: AttributeSource.ai, digits: '10', confidence: 0.3 },
    })

    // Photo C: 1 bib confidence 0.90, status=processed
    photoC = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
    await prisma.photo.update({
      where: { id: photoC },
      data: { status: 'processed', uploaded_at: new Date('2026-01-03T00:00:00Z') },
    })
    await prisma.photoBib.create({
      data: { photo_id: photoC, source: AttributeSource.ai, digits: '20', confidence: 0.9 },
    })

    // Photo D: 1 bib confidence 0.50, status=reviewed (already reviewed)
    photoD = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
    await prisma.photo.update({
      where: { id: photoD },
      data: {
        status: 'reviewed',
        reviewed_at: new Date('2026-01-04T00:00:00Z'),
        uploaded_at: new Date('2026-01-04T00:00:00Z'),
      },
    })
    await prisma.photoBib.create({
      data: { photo_id: photoD, source: AttributeSource.ai, digits: '30', confidence: 0.5 },
    })
  })

  afterAll(async () => {
    const ids = [photoA, photoB, photoC, photoD].filter(Boolean)
    if (ids.length) {
      await prisma.photoBib.deleteMany({ where: { photo_id: { in: ids } } })
      await prisma.photo.deleteMany({ where: { id: { in: ids } } })
    }
    await prisma.event.deleteMany({ where: { id: eventId } }).catch(() => undefined)
    for (const uid of createdUserIds) {
      await prisma.userRole.deleteMany({ where: { user_id: uid } })
      await prisma.user.delete({ where: { id: uid } }).catch(() => undefined)
    }
    await app.close()
  })

  it('GET default (onlyPending=true) → A, B, C in order; D excluded', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventSlug}/review-queue`)
      .set('Authorization', bearer)
      .expect(200)

    const items = res.body.data as Array<{ id: string; minBibConfidence: number | null }>
    const ids = items.map((i) => i.id)
    expect(ids).toContain(photoA)
    expect(ids).toContain(photoB)
    expect(ids).toContain(photoC)
    expect(ids).not.toContain(photoD)
    // Order: A (NULL min) first, then B (0.30), then C (0.90)
    expect(ids.indexOf(photoA)).toBeLessThan(ids.indexOf(photoB))
    expect(ids.indexOf(photoB)).toBeLessThan(ids.indexOf(photoC))
    expect(res.body.meta.pagination.total).toBe(3)
    expect(res.body.meta.pagination.page).toBe(1)
    expect(res.body.meta.pagination.limit).toBe(50)
    expect(res.body.meta.pagination.totalPages).toBe(1)
  })

  it('GET onlyPending=false → returns all 4 including reviewed photo', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventSlug}/review-queue?onlyPending=false`)
      .set('Authorization', bearer)
      .expect(200)

    const ids = (res.body.data as Array<{ id: string }>).map((i) => i.id)
    expect(ids).toEqual(expect.arrayContaining([photoA, photoB, photoC, photoD]))
    expect(res.body.meta.pagination.total).toBe(4)
  })

  it('pagination: page=1&limit=2 returns 2; page=2 returns 1', async () => {
    const r1 = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventSlug}/review-queue?page=1&limit=2`)
      .set('Authorization', bearer)
      .expect(200)
    expect(r1.body.data).toHaveLength(2)
    expect(r1.body.meta.pagination.total).toBe(3)
    expect(r1.body.meta.pagination.page).toBe(1)
    expect(r1.body.meta.pagination.limit).toBe(2)
    expect(r1.body.meta.pagination.totalPages).toBe(2)

    const r2 = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventSlug}/review-queue?page=2&limit=2`)
      .set('Authorization', bearer)
      .expect(200)
    expect(r2.body.data).toHaveLength(1)
    expect(r2.body.meta.pagination.page).toBe(2)
  })

  it('limit > 100 is rejected by DTO validation (Max=100) → 400', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/events/${eventSlug}/review-queue?limit=999`)
      .set('Authorization', bearer)
      .expect(400)
  })

  it('thumbnailUrl is populated (string, not null)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventSlug}/review-queue`)
      .set('Authorization', bearer)
      .expect(200)
    for (const item of res.body.data) {
      expect(typeof item.thumbnailUrl).toBe('string')
      expect(item.thumbnailUrl.length).toBeGreaterThan(0)
    }
  })

  it('without JWT → 401', async () => {
    await request(app.getHttpServer()).get(`/api/v1/events/${eventSlug}/review-queue`).expect(401)
  })

  it('with customer role → 403', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/events/${eventSlug}/review-queue`)
      .set('Authorization', customerBearer)
      .expect(403)
  })
})
