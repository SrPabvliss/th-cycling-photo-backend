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
import { createAuthenticatedUser, type TestAuthUser } from './fixtures/factories/auth.factory'
import { ensurePaymentSystemUser } from './fixtures/factories/payment-system-user.factory'
import { createPhotoFixture } from './fixtures/factories/photo.factory'
import { createOnSaleEventFixture } from './fixtures/factories/user.factory'

/**
 * Signing in brings the anonymous cart into the account's cart. A photo the buyer had taken out
 * of the account's cart and then added again without a session is wanted again: it comes back,
 * exactly as adding it again while signed in brings it back.
 */
describe('Merging the anonymous cart at sign-in (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let buyer: TestAuthUser
  let eventId: string
  const sessionPrefix = `merge-${Date.now()}-`
  let sessionCount = 0

  const db = () => prisma as unknown as PrismaClient
  const http = () => request(app.getHttpServer())
  const auth = () => ({ Authorization: `Bearer ${buyer.token}` })

  const addSignedIn = (photoId: string) =>
    http().post('/api/v1/cart/items').set(auth()).send({ photoId }).expect(201)
  const addAnonymously = (photoId: string, sessionId: string) =>
    http().post('/api/v1/cart/items').send({ photoId, sessionId }).expect(201)
  const removeSignedIn = (photoId: string) =>
    http().delete(`/api/v1/cart/items/${photoId}`).set(auth()).expect(200)
  const merge = (sessionId: string) =>
    http().post('/api/v1/cart/merge').set(auth()).send({ sessionId })

  async function accountCartPhotoIds(): Promise<string[]> {
    const res = await http().get('/api/v1/cart').set(auth()).expect(200)
    return res.body.data
      .flatMap((group: { photos: Array<{ id: string }> }) => group.photos.map((photo) => photo.id))
      .sort()
  }

  const newSession = () => `${sessionPrefix}${++sessionCount}`

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

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
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)))
    prisma = moduleFixture.get(PrismaService)
    // Another suite may have truncated `users`; PaymentSystemActor refuses to boot without it.
    await ensurePaymentSystemUser(prisma as unknown as PrismaClient)
    await app.init()

    buyer = await createAuthenticatedUser(db(), moduleFixture.get(JwtService), 'customer')
    // The cart only takes photos of an event on sale (cover image, not archived).
    eventId = await createOnSaleEventFixture(db())
  })

  afterEach(async () => {
    const carts = await prisma.cart.findMany({
      where: { OR: [{ user_id: buyer.userId }, { session_id: { startsWith: sessionPrefix } }] },
    })
    await prisma.cartItem.deleteMany({ where: { cart_id: { in: carts.map((cart) => cart.id) } } })
    await prisma.cart.deleteMany({ where: { id: { in: carts.map((cart) => cart.id) } } })
  })

  afterAll(async () => {
    if (eventId) {
      await prisma.photo.deleteMany({ where: { event_id: eventId } })
      await prisma.event.deleteMany({ where: { id: eventId } })
    }
    if (buyer) {
      await prisma.userRole.deleteMany({ where: { user_id: buyer.userId } })
      await prisma.user.deleteMany({ where: { id: buyer.userId } })
    }
    await app.close()
  })

  it('brings back a photo taken out of the account cart and added again without a session', async () => {
    const kept = await createPhotoFixture(db(), eventId)
    const readded = await createPhotoFixture(db(), eventId)
    await addSignedIn(kept)
    await addSignedIn(readded)
    await removeSignedIn(readded)

    const sessionId = newSession()
    await addAnonymously(readded, sessionId)
    const res = await merge(sessionId).expect(201)

    expect(await accountCartPhotoIds()).toEqual([kept, readded].sort())
    expect(res.body.data.mergedCount).toBe(1)
  })

  it('counts only the photos that were not in the account cart already', async () => {
    const both = await createPhotoFixture(db(), eventId)
    const fresh = await createPhotoFixture(db(), eventId)
    await addSignedIn(both)

    const sessionId = newSession()
    await addAnonymously(both, sessionId)
    await addAnonymously(fresh, sessionId)
    const res = await merge(sessionId).expect(201)

    expect(await accountCartPhotoIds()).toEqual([both, fresh].sort())
    expect(res.body.data.mergedCount).toBe(1)
  })

  it('leaves out a photo taken out of the anonymous cart before signing in', async () => {
    const accountPhoto = await createPhotoFixture(db(), eventId)
    const droppedAnonymously = await createPhotoFixture(db(), eventId)
    await addSignedIn(accountPhoto)

    const sessionId = newSession()
    await addAnonymously(droppedAnonymously, sessionId)
    await http().delete(`/api/v1/cart/items/${droppedAnonymously}`).query({ sessionId }).expect(200)
    const res = await merge(sessionId).expect(201)

    expect(await accountCartPhotoIds()).toEqual([accountPhoto])
    expect(res.body.data.mergedCount).toBe(0)
  })
})
