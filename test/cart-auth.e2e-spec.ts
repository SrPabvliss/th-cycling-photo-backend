import { randomUUID } from 'node:crypto'
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

describe('Cart routes: optional session (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let jwt: JwtService
  let buyer: TestAuthUser
  let eventId: string
  let photoId: string
  const sessionIds: string[] = []

  const newSession = () => {
    const sessionId = `e2e-${randomUUID()}`
    sessionIds.push(sessionId)
    return sessionId
  }

  const expiredToken = () =>
    jwt.sign({ sub: buyer.userId, email: buyer.email, role: 'customer', pv: 0 }, { expiresIn: -60 })
  /** Well signed and not expired, but minted for a session version the account no longer has. */
  const revokedToken = () =>
    jwt.sign({ sub: buyer.userId, email: buyer.email, role: 'customer', pv: 999 })
  const forgedToken = () => `${buyer.token.slice(0, -4)}AAAA`

  const itemsInSessionCart = (sessionId: string) =>
    prisma.cartItem.count({ where: { cart: { session_id: sessionId }, removed_at: null } })
  const itemsInBuyerCart = () =>
    prisma.cartItem.count({ where: { cart: { user_id: buyer.userId }, removed_at: null } })

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
    await ensurePaymentSystemUser(moduleFixture.get(PrismaService))
    await app.init()

    prisma = moduleFixture.get(PrismaService)
    jwt = moduleFixture.get(JwtService)
    buyer = await createAuthenticatedUser(prisma as never, jwt, 'customer')
    eventId = await createOnSaleEventFixture(prisma as unknown as PrismaClient)
    photoId = await createPhotoFixture(prisma as unknown as PrismaClient, eventId)
  })

  afterAll(async () => {
    const carts = await prisma.cart.findMany({
      where: { OR: [{ user_id: buyer?.userId }, { session_id: { in: sessionIds } }] },
      select: { id: true },
    })
    const cartIds = carts.map((cart) => cart.id)
    await prisma.cartItem.deleteMany({ where: { cart_id: { in: cartIds } } })
    await prisma.cart.deleteMany({ where: { id: { in: cartIds } } })
    if (photoId) await prisma.photo.deleteMany({ where: { id: photoId } })
    if (eventId) await prisma.event.deleteMany({ where: { id: eventId } })
    if (buyer) {
      await prisma.userRole.deleteMany({ where: { user_id: buyer.userId } })
      await prisma.user.deleteMany({ where: { id: buyer.userId } })
    }
    await app.close()
  })

  describe('without an Authorization header: anonymous, as before', () => {
    it('reads, adds to and removes from the session cart', async () => {
      const sessionId = newSession()

      const empty = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .query({ sessionId })
        .expect(200)
      expect(empty.body.data).toEqual([])

      const added = await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .send({ photoId, sessionId })
        .expect(201)
      expect(added.body.data).toEqual({ itemCount: 1, eventCount: 1 })
      expect(await itemsInSessionCart(sessionId)).toBe(1)

      const listed = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .query({ sessionId })
        .expect(200)
      expect(listed.body.data[0].photos.map((photo: { id: string }) => photo.id)).toEqual([photoId])

      const removed = await request(app.getHttpServer())
        .delete(`/api/v1/cart/items/${photoId}`)
        .query({ sessionId })
        .expect(200)
      expect(removed.body.data).toEqual({ itemCount: 0, eventCount: 0 })
    })
  })

  describe('with a valid token: the account cart, as before', () => {
    it('adds to the cart of the account and ignores the session id it also carries', async () => {
      const sessionId = newSession()

      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({ photoId, sessionId })
        .expect(201)

      expect(await itemsInBuyerCart()).toBe(1)
      expect(await itemsInSessionCart(sessionId)).toBe(0)

      const listed = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(200)
      expect(listed.body.data).toHaveLength(1)

      await request(app.getHttpServer())
        .delete(`/api/v1/cart/items/${photoId}`)
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(200)
      expect(await itemsInBuyerCart()).toBe(0)
    })
  })

  describe('with an Authorization header that does not hold: 401, never anonymous', () => {
    const cases: Array<[string, () => string]> = [
      ['an expired token', () => `Bearer ${expiredToken()}`],
      ['a token with a forged signature', () => `Bearer ${forgedToken()}`],
      ['a token of a session that is no longer valid', () => `Bearer ${revokedToken()}`],
      ['text that is not a token', () => 'Bearer not-a-jwt'],
      ['a Bearer scheme with no token', () => 'Bearer'],
      ['another scheme', () => 'Basic dXNlcjpwYXNz'],
    ]

    it.each(cases)('GET /cart answers 401 to %s', async (_case, header) => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .query({ sessionId: newSession() })
        .set('Authorization', header())
        .expect(401)

      expect(res.body.error.code).toBe('UNAUTHORIZED')
    })

    it.each(cases)('POST /cart/items answers 401 to %s and adds nothing', async (_case, header) => {
      const sessionId = newSession()

      const res = await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .set('Authorization', header())
        .send({ photoId, sessionId })
        .expect(401)

      expect(res.body.error.code).toBe('UNAUTHORIZED')
      expect(await itemsInSessionCart(sessionId)).toBe(0)
      expect(await itemsInBuyerCart()).toBe(0)
    })

    it.each(
      cases,
    )('DELETE /cart/items/:photoId answers 401 to %s and removes nothing', async (_case, header) => {
      const sessionId = newSession()
      await request(app.getHttpServer())
        .post('/api/v1/cart/items')
        .send({ photoId, sessionId })
        .expect(201)

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/cart/items/${photoId}`)
        .query({ sessionId })
        .set('Authorization', header())
        .expect(401)

      expect(res.body.error.code).toBe('UNAUTHORIZED')
      expect(await itemsInSessionCart(sessionId)).toBe(1)
    })

    it('answers an expired token exactly as a protected route does', async () => {
      const authorization = `Bearer ${expiredToken()}`

      const cart = await request(app.getHttpServer())
        .get('/api/v1/cart')
        .set('Authorization', authorization)
        .expect(401)
      const protectedRoute = await request(app.getHttpServer())
        .get('/api/v1/users/me/billing-accounts')
        .set('Authorization', authorization)
        .expect(401)

      expect(cart.body.error).toEqual(protectedRoute.body.error)
      expect(Object.keys(cart.body).sort()).toEqual(Object.keys(protectedRoute.body).sort())
    })
  })
})
