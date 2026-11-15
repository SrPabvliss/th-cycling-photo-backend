import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@generated/prisma/client'
import { MailService } from '@mail/application/services/mail.service'
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
 * Regenerating a delivery link replaces the one the buyer got by email, which stops working at
 * once. The buyer is therefore emailed the new link, so they are never left with only a dead one
 * when staff do not finish sending it by WhatsApp.
 */
describe('Regenerating a delivery link (e2e)', () => {
  let app: INestApplication<App>
  let prisma: PrismaService
  let buyer: TestAuthUser
  let staff: TestAuthUser
  let eventId: string
  let orderId: string
  const oldToken = randomBytes(32).toString('hex')
  const mail = { enqueue: jest.fn().mockResolvedValue(undefined) }

  const db = () => prisma as unknown as PrismaClient

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mail)
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
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)))
    prisma = moduleFixture.get(PrismaService)
    // Another suite may have truncated `users`; PaymentSystemActor refuses to boot without it.
    await ensurePaymentSystemUser(prisma as unknown as PrismaClient)
    await app.init()

    const jwt = moduleFixture.get(JwtService)
    buyer = await createAuthenticatedUser(db(), jwt, 'customer')
    staff = await createAuthenticatedUser(db(), jwt, 'admin')
    eventId = await createEventFixture(db())
    const photoId = await createPhotoFixture(db(), eventId)

    const order = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: buyer.userId,
        status: 'delivered',
        subtotal: '4.00',
        snap_currency: 'USD',
        snap_first_name: 'Ana',
        snap_last_name: 'Rider',
        snap_email: 'ana.rider@test.local',
        paid_at: new Date(),
        delivered_at: new Date(),
        items: { create: [{ photo_id: photoId, unit_price: '4.00', delivered_as: 'original' }] },
      },
    })
    orderId = order.id
    await prisma.deliveryLink.create({
      data: {
        order_id: orderId,
        token: oldToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
  })

  afterAll(async () => {
    if (orderId) {
      await prisma.deliveryLink.deleteMany({ where: { order_id: orderId } })
      await prisma.orderItem.deleteMany({ where: { order_id: orderId } })
      await prisma.order.deleteMany({ where: { id: orderId } })
    }
    if (eventId) {
      await prisma.photo.deleteMany({ where: { event_id: eventId } })
      await prisma.event.deleteMany({ where: { id: eventId } })
    }
    for (const user of [buyer, staff].filter(Boolean)) {
      await prisma.userRole.deleteMany({ where: { user_id: user.userId } })
      await prisma.user.deleteMany({ where: { id: user.userId } })
    }
    await app.close()
  })

  it('emails the buyer the new link, which replaces the old one', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/regenerate-delivery`)
      .set({ Authorization: `Bearer ${staff.token}` })
      .expect(201)

    const newUrl: string = res.body.data.deliveryUrl
    expect(newUrl).not.toContain(oldToken)

    expect(mail.enqueue).toHaveBeenCalledTimes(1)
    expect(mail.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana.rider@test.local',
        template: 'order-delivered',
        vars: expect.objectContaining({ deliveryUrl: newUrl, firstName: 'Ana' }),
      }),
    )

    await request(app.getHttpServer()).get(`/api/v1/delivery/${oldToken}`).expect(404)
    await request(app.getHttpServer()).get(`/api/v1/delivery/${res.body.data.token}`).expect(200)
  })
})
