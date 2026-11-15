import { randomBytes } from 'node:crypto'
import { CONSENT_TYPE, POLICY_VERSIONS } from '@auth/domain/constants/consent.constants'
import type { OrderStatus, PrismaClient } from '@generated/prisma/client'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { Test, type TestingModule } from '@nestjs/testing'
import { ThrottlerStorage, type ThrottlerStorageService } from '@nestjs/throttler'
import request from 'supertest'
import type { App } from 'supertest/types'
import { AppModule } from '../src/app.module'
import { GlobalExceptionFilter } from '../src/shared/http/filters/global-exception.filter'
import { ResponseInterceptor } from '../src/shared/http/interceptors/response.interceptor'
import { PrismaService } from '../src/shared/infrastructure'
import { createAuthenticatedUser, type TestAuthUser } from './fixtures/factories/auth.factory'
import { ensurePaymentSystemUser } from './fixtures/factories/payment-system-user.factory'
import { createPhotoFixture } from './fixtures/factories/photo.factory'
import { createEventFixture } from './fixtures/factories/user.factory'

/**
 * A preview link is taken while an order on it is alive: placed and not cancelled, or a card
 * draft whose payment is still under way. Once that order is cancelled, or the card draft is
 * abandoned, the link serves again until it expires, for the same buyer or anyone else. An
 * abandoned draft of someone else is given up when the link is ordered from again, so the link
 * never carries two live orders.
 */
describe('A preview link whose order is no longer alive (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let first: TestAuthUser
  let second: TestAuthUser
  let staff: TestAuthUser
  let eventId: string
  const billing = new Map<string, string>()
  const linkIds: string[] = []
  const transactionIds: string[] = []

  const db = () => prisma as unknown as PrismaClient
  const http = () => request(app.getHttpServer())
  const as = (user: TestAuthUser) => ({ Authorization: `Bearer ${user.token}` })

  async function link(expiresInMs = 86_400_000) {
    const photoId = await createPhotoFixture(db(), eventId)
    const created = await prisma.previewLink.create({
      data: {
        token: randomBytes(32).toString('hex'),
        event_id: eventId,
        expires_at: new Date(Date.now() + expiresInMs),
        created_by_id: staff.userId,
        photos: { create: [{ photo_id: photoId }] },
      },
    })
    linkIds.push(created.id)
    return { id: created.id, token: created.token, photoId }
  }

  const order = (user: TestAuthUser, token: string, photoId: string, method = 'transfer') =>
    http()
      .post(`/api/v1/preview/${token}/orders`)
      .set(as(user))
      .send({ photoIds: [photoId], method, billingAccountId: billing.get(user.userId) })

  const statusOf = async (token: string) =>
    (await http().get(`/api/v1/preview/${token}`).expect(200)).body.data.status

  async function cardDraftOf(
    user: TestAuthUser,
    linkId: string,
    photoId: string,
    payment: 'initiated' | 'expired',
  ) {
    const draft = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: user.userId,
        preview_link_id: linkId,
        status: 'draft' as OrderStatus,
        payment_method: 'card',
        subtotal: '4.00',
        snap_currency: 'USD',
        items: { create: [{ photo_id: photoId, unit_price: '4.00' }] },
      },
    })
    const transaction = await prisma.paymentTransaction.create({
      data: {
        client_transaction_id: `tt-${randomBytes(8).toString('hex')}`,
        provider: 'payphone',
        status: payment,
        amount_cents: 400,
        amount_without_tax_cents: 400,
        amount_with_tax_cents: 0,
        tax_cents: 0,
        commission_cents: 20,
        mode_snapshot: 'split_receiver',
        receiver_snapshot: '0991234567',
        orders: { create: [{ order_id: draft.id }] },
      },
    })
    transactionIds.push(transaction.id)
    await prisma.previewLink.update({ where: { id: linkId }, data: { status: 'converted' } })
    return draft.id
  }

  async function buyerReady(user: TestAuthUser) {
    const ecuador = await prisma.country.findFirstOrThrow({ where: { iso_code: 'EC' } })
    await prisma.customerProfile.create({ data: { user_id: user.userId, country_id: ecuador.id } })
    const account = await prisma.billingAccount.create({
      data: {
        user_id: user.userId,
        id_type: 'national_id',
        id_number: '1710034065',
        legal_name: 'E2E Customer',
        email: `${user.userId}@test.local`,
        is_default: true,
      },
    })
    billing.set(user.userId, account.id)
    await prisma.userConsent.create({
      data: {
        user_id: user.userId,
        type: CONSENT_TYPE.ELECTRONIC_INVOICE,
        policy_version: POLICY_VERSIONS[CONSENT_TYPE.ELECTRONIC_INVOICE],
      },
    })
  }

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
    await ensurePaymentSystemUser(db())
    await app.init()

    const jwt = moduleFixture.get(JwtService)
    first = await createAuthenticatedUser(db(), jwt, 'customer')
    second = await createAuthenticatedUser(db(), jwt, 'customer')
    staff = await createAuthenticatedUser(db(), jwt, 'admin')
    await buyerReady(first)
    await buyerReady(second)
    eventId = await createEventFixture(db())
  })

  // GET /preview/:token allows 10 lookups a minute per IP, and every request here comes from the
  // same one. Each test starts with a clean count so the suite tests links, not the rate limit.
  beforeEach(() => {
    app.get<ThrottlerStorageService>(ThrottlerStorage).storage.clear()
  })

  afterAll(async () => {
    const users = [first, second, staff].filter(Boolean)
    const orders = await prisma.order.findMany({
      where: { user_id: { in: users.map((user) => user.userId) } },
      select: { id: true },
    })
    const orderIds = orders.map((o) => o.id)
    await prisma.rikuchiyOutboxItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.paymentTransactionOrder.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.paymentTransaction.deleteMany({ where: { id: { in: transactionIds } } })
    await prisma.orderItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
    await prisma.previewLinkPhoto.deleteMany({ where: { preview_link_id: { in: linkIds } } })
    await prisma.previewLink.deleteMany({ where: { id: { in: linkIds } } })
    if (eventId) {
      await prisma.photo.deleteMany({ where: { event_id: eventId } })
      await prisma.event.deleteMany({ where: { id: eventId } })
    }
    for (const user of users) {
      await prisma.billingAccount.deleteMany({ where: { user_id: user.userId } })
      await prisma.customerProfile.deleteMany({ where: { user_id: user.userId } })
      await prisma.userConsent.deleteMany({ where: { user_id: user.userId } })
      await prisma.userRole.deleteMany({ where: { user_id: user.userId } })
      await prisma.user.deleteMany({ where: { id: user.userId } })
    }
    await app.close()
  })

  describe('after the buyer cancels the order placed from it', () => {
    async function cancelledOrder() {
      const preview = await link()
      const placed = await order(first, preview.token, preview.photoId).expect(201)
      expect(await statusOf(preview.token)).toBe('converted')
      await http()
        .patch(`/api/v1/orders/me/${placed.body.data.id}/cancel`)
        .set(as(first))
        .expect(200)
      return preview
    }

    it('serves again: the link is active', async () => {
      const preview = await cancelledOrder()

      expect(await statusOf(preview.token)).toBe('active')
      const stored = await prisma.previewLink.findUniqueOrThrow({ where: { id: preview.id } })
      expect(stored.status).toBe('active')
    })

    it('lets the same buyer order again', async () => {
      const preview = await cancelledOrder()

      await order(first, preview.token, preview.photoId).expect(201)

      expect(await statusOf(preview.token)).toBe('converted')
    })

    it('lets someone else order', async () => {
      const preview = await cancelledOrder()

      await order(second, preview.token, preview.photoId).expect(201)
    })

    it('stays expired once its time is up', async () => {
      const preview = await cancelledOrder()
      await prisma.previewLink.update({
        where: { id: preview.id },
        data: { expires_at: new Date(Date.now() - 1000) },
      })

      await http().get(`/api/v1/preview/${preview.token}`).expect(410)
    })
  })

  describe('with a card draft of someone else', () => {
    it('serves again once the draft was abandoned, and gives that draft up when ordered from', async () => {
      const preview = await link()
      const abandoned = await cardDraftOf(first, preview.id, preview.photoId, 'expired')

      expect(await statusOf(preview.token)).toBe('active')
      await order(second, preview.token, preview.photoId).expect(201)

      expect((await prisma.order.findUniqueOrThrow({ where: { id: abandoned } })).status).toBe(
        'cancelled',
      )
      const live = await prisma.order.count({
        where: { preview_link_id: preview.id, status: { not: 'cancelled' } },
      })
      expect(live).toBe(1)
    })

    it('stays taken while that draft is being paid', async () => {
      const preview = await link()
      const paying = await cardDraftOf(first, preview.id, preview.photoId, 'initiated')

      expect(await statusOf(preview.token)).toBe('converted')
      const res = await order(second, preview.token, preview.photoId).expect(422)

      expect(res.body.error.messageKey).toBe('order.already_submitted')
      expect((await prisma.order.findUniqueOrThrow({ where: { id: paying } })).status).toBe('draft')
    })
  })

  it('stays taken while an order placed from it is alive', async () => {
    const preview = await link()
    await order(first, preview.token, preview.photoId).expect(201)

    const res = await order(second, preview.token, preview.photoId).expect(422)

    expect(res.body.error.messageKey).toBe('order.already_submitted')
    expect(await statusOf(preview.token)).toBe('converted')
  })

  describe('telling the viewer whether the order that took it is theirs', () => {
    const view = (token: string, user?: TestAuthUser) => {
      const req = http().get(`/api/v1/preview/${token}`)
      return (user ? req.set(as(user)) : req).expect(200)
    }

    it('gives its owner the order id, and nobody else anything about it', async () => {
      const preview = await link()
      const placed = await order(first, preview.token, preview.photoId).expect(201)
      const orderId: string = placed.body.data.id

      const owner = await view(preview.token, first)
      const someoneElse = await view(preview.token, second)
      const anonymous = await view(preview.token)

      expect(owner.body.data).toMatchObject({ status: 'converted', myOrderId: orderId })
      expect(someoneElse.body.data).toMatchObject({ status: 'converted', myOrderId: null })
      expect(anonymous.body.data).toMatchObject({ status: 'converted', myOrderId: null })
      expect(JSON.stringify(someoneElse.body.data)).not.toContain(orderId)
      expect(JSON.stringify(anonymous.body.data)).not.toContain(orderId)
    })

    it('gives the owner of a card draft being paid its id', async () => {
      const preview = await link()
      const paying = await cardDraftOf(first, preview.id, preview.photoId, 'initiated')

      expect((await view(preview.token, first)).body.data.myOrderId).toBe(paying)
    })

    it('gives nobody an id once the order is cancelled and the link is active again', async () => {
      const preview = await link()
      const placed = await order(first, preview.token, preview.photoId).expect(201)
      await http()
        .patch(`/api/v1/orders/me/${placed.body.data.id}/cancel`)
        .set(as(first))
        .expect(200)

      expect((await view(preview.token, first)).body.data).toMatchObject({
        status: 'active',
        myOrderId: null,
      })
    })
  })
})
