import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import configuration from '../src/config/configuration'
import { Order } from '../src/modules/orders/domain/entities'
import { OrderReadRepository } from '../src/modules/orders/infrastructure/repositories/order-read.repository'
import { OrderWriteRepository } from '../src/modules/orders/infrastructure/repositories/order-write.repository'
import { CdnUrlBuilder } from '../src/shared/cloudflare/infrastructure'
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service'
import { createEventFixture, createUserFixture } from './fixtures/factories/user.factory'

describe('Order sale/gift conversion — revenue (integration)', () => {
  let prisma: PrismaService
  let readRepo: OrderReadRepository
  let writeRepo: OrderWriteRepository
  let eventId: string
  let userId: string
  let orderId: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV || 'test'}`, '.env'],
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [PrismaService, CdnUrlBuilder, OrderReadRepository, OrderWriteRepository],
    }).compile()

    prisma = moduleRef.get(PrismaService)
    readRepo = moduleRef.get(OrderReadRepository)
    writeRepo = moduleRef.get(OrderWriteRepository)
    await prisma.$connect()
  })

  beforeEach(async () => {
    userId = await createUserFixture(prisma)
    eventId = await createEventFixture(prisma)

    const order = Order.create({
      previewLinkId: null,
      eventId,
      userId,
      notes: null,
      subtotal: 17.5,
      snapCurrency: 'USD',
    })
    order.confirmPayment(userId)
    order.markDelivered()
    await writeRepo.save(order)
    orderId = order.id
  })

  afterEach(async () => {
    await prisma.order.deleteMany({ where: { event_id: eventId } })
    await prisma.event.delete({ where: { id: eventId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('drops the order out of revenue when converted to a gift, and back in when converted to a sale', async () => {
    expect(await readRepo.sumRevenue(eventId)).toBe('17.5')

    const delivered = await readRepo.findById(orderId)
    delivered!.convertToGift(userId)
    await writeRepo.save(delivered!)

    expect(await readRepo.sumRevenue(eventId)).toBe('0')

    const gifted = await readRepo.findById(orderId)
    gifted!.convertToSale(userId)
    await writeRepo.save(gifted!)

    expect(await readRepo.sumRevenue(eventId)).toBe('17.5')
  })

  it('keeps deliveredAt across a full round trip and lands back on delivered', async () => {
    const original = await readRepo.findById(orderId)
    const deliveredAt = original!.deliveredAt

    original!.convertToGift(userId)
    await writeRepo.save(original!)

    const gifted = await readRepo.findById(orderId)
    expect(gifted!.status).toBe('gifted')
    expect(gifted!.paidAt).toBeNull()
    expect(gifted!.deliveredAt?.getTime()).toBe(deliveredAt?.getTime())

    gifted!.convertToSale(userId)
    await writeRepo.save(gifted!)

    const backToSale = await readRepo.findById(orderId)
    expect(backToSale!.status).toBe('delivered')
    expect(backToSale!.deliveredAt?.getTime()).toBe(deliveredAt?.getTime())
    expect(backToSale!.paidAt?.getTime()).toBe(deliveredAt?.getTime())
  })
})
