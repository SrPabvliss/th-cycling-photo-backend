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
import { createEventFixture } from './fixtures/factories/user.factory'

describe('Staff marking a transfer order as paid (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let staff: TestAuthUser
  let buyer: TestAuthUser
  let eventId: string
  const orderIds: string[] = []

  const db = () => prisma as unknown as PrismaClient
  const confirmPayment = (orderId: string) =>
    request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/confirm-payment`)
      .set('Authorization', `Bearer ${staff.token}`)
  const emissionsOf = (orderId: string) =>
    prisma.rikuchiyOutboxItem.count({ where: { order_id: orderId, kind: 'emit' } })

  async function createPendingTransferOrder(): Promise<string> {
    const photoId = await createPhotoFixture(db(), eventId)
    const order = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: buyer.userId,
        status: 'pending',
        payment_method: 'transfer',
        subtotal: '8.00',
        snap_currency: 'USD',
        snap_email: 'ana@correo.com',
        snap_billing_id_type: 'national_id',
        snap_billing_id_number: '1710034065',
        snap_billing_legal_name: 'Ana Rider',
        snap_billing_email: 'ana@correo.com',
        snap_invoice_consent_at: new Date('2026-11-12T15:00:00Z'),
        snap_invoice_consent_ip: '190.1.1.1',
        items: { create: [{ photo_id: photoId, unit_price: '8.00' }] },
      },
    })
    orderIds.push(order.id)
    return order.id
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
    staff = await createAuthenticatedUser(db(), jwt, 'admin')
    buyer = await createAuthenticatedUser(db(), jwt, 'customer')
    eventId = await createEventFixture(db())
  })

  afterAll(async () => {
    await prisma.rikuchiyOutboxItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.orderItem.deleteMany({ where: { order_id: { in: orderIds } } })
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
    if (eventId) {
      await prisma.photo.deleteMany({ where: { event_id: eventId } })
      await prisma.event.deleteMany({ where: { id: eventId } })
    }
    for (const user of [staff, buyer].filter(Boolean)) {
      await prisma.userRole.deleteMany({ where: { user_id: user.userId } })
      await prisma.user.deleteMany({ where: { id: user.userId } })
    }
    await app.close()
  })

  it('pays a pending transfer order, answering as before, with one invoice request', async () => {
    const orderId = await createPendingTransferOrder()

    const res = await confirmPayment(orderId).expect(200)

    expect(res.body.data).toEqual({ id: orderId })
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(order.status).toBe('paid')
    expect(order.confirmed_by_id).toBe(staff.userId)
    expect(await emissionsOf(orderId)).toBe(1)
  })

  it('answers 422 for an order already paid, as before, and requests no second invoice', async () => {
    const orderId = await createPendingTransferOrder()
    await confirmPayment(orderId).expect(200)
    const paidAt = (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paid_at

    await confirmPayment(orderId).expect(422)

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
    expect(order.paid_at).toEqual(paidAt)
    expect(await emissionsOf(orderId)).toBe(1)
  })

  it('pays once when staff clicks twice at the same time: one 200, one 422', async () => {
    const orderId = await createPendingTransferOrder()

    const statuses = (await Promise.all([confirmPayment(orderId), confirmPayment(orderId)]))
      .map((res) => res.status)
      .sort()

    expect(statuses).toEqual([200, 422])
    expect(await emissionsOf(orderId)).toBe(1)
  })
})
