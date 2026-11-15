import type { OrderStatus, PrismaClient } from '@generated/prisma/client'
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
import { createEventFixture } from './fixtures/factories/user.factory'

/**
 * Once staff have sent the buyer where to transfer, the buyer may already have paid. A buyer who
 * cancels then must not leave staff unaware: they are told, so a transfer arriving later is given
 * back. Cancelling an order still waiting for those details tells no one: nothing can be paid yet.
 */
describe('A buyer cancelling after receiving the payment details (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let buyer: TestAuthUser
  let staff: TestAuthUser
  let eventId: string

  const db = () => prisma as unknown as PrismaClient

  async function order(status: OrderStatus) {
    const photoId = await createPhotoFixture(db(), eventId)
    const created = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: buyer.userId,
        status,
        payment_method: 'transfer',
        subtotal: '8.00',
        snap_currency: 'USD',
        snap_first_name: 'Ana',
        snap_last_name: 'Rider',
        notified_at: status === 'payment_info_sent' ? new Date() : null,
        notified_by_id: status === 'payment_info_sent' ? staff.userId : null,
        items: { create: [{ photo_id: photoId, unit_price: '8.00' }] },
      },
    })
    return created.id
  }

  const cancel = (orderId: string) =>
    request(app.getHttpServer())
      .patch(`/api/v1/orders/me/${orderId}/cancel`)
      .set({ Authorization: `Bearer ${buyer.token}` })
      .expect(200)

  const alertsFor = (userId: string, orderId: string) =>
    prisma.notification.findMany({
      where: {
        user_id: userId,
        type: 'order.cancelled_by_buyer',
        data: { path: ['orderId'], equals: orderId },
      },
    })

  async function waitForAlerts(userId: string, orderId: string, expected: number) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const alerts = await alertsFor(userId, orderId)
      if (alerts.length >= expected) return alerts
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    return alertsFor(userId, orderId)
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
    // Another suite may have truncated `users`; PaymentSystemActor refuses to boot without it.
    await ensurePaymentSystemUser(prisma as unknown as PrismaClient)
    await app.init()

    const jwt = moduleFixture.get(JwtService)
    buyer = await createAuthenticatedUser(db(), jwt, 'customer')
    staff = await createAuthenticatedUser(db(), jwt, 'admin')
    eventId = await createEventFixture(db())
  })

  afterAll(async () => {
    const users = [buyer, staff].filter(Boolean)
    await prisma.notification.deleteMany({ where: { user_id: { in: users.map((u) => u.userId) } } })
    const orders = await prisma.order.findMany({
      where: { user_id: buyer?.userId },
      select: { id: true },
    })
    const orderIds = orders.map((o) => o.id)
    await prisma.rikuchiyOutboxItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.orderItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
    if (eventId) {
      await prisma.photo.deleteMany({ where: { event_id: eventId } })
      await prisma.event.deleteMany({ where: { id: eventId } })
    }
    for (const user of users) {
      await prisma.userRole.deleteMany({ where: { user_id: user.userId } })
      await prisma.user.deleteMany({ where: { id: user.userId } })
    }
    await app.close()
  })

  it('tells staff when the payment details had already been sent', async () => {
    const orderId = await order('payment_info_sent')

    await cancel(orderId)

    const alerts = await waitForAlerts(staff.userId, orderId, 1)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ title: 'Pedido cancelado por el comprador' })
    expect(alerts[0].message).toContain(orderId.slice(0, 8).toUpperCase())
    expect(alerts[0].data).toMatchObject({ orderId, eventId, photoCount: 1 })
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(
      'cancelled',
    )
  })

  it('never tells the buyer who cancelled', async () => {
    const orderId = await order('payment_info_sent')

    await cancel(orderId)
    await waitForAlerts(staff.userId, orderId, 1)

    expect(await alertsFor(buyer.userId, orderId)).toHaveLength(0)
  })

  it('tells no one when the order was still waiting for the payment details', async () => {
    const orderId = await order('pending')

    await cancel(orderId)
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(await alertsFor(staff.userId, orderId)).toHaveLength(0)
  })
})
