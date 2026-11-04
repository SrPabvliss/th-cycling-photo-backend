import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import type { CachedTaxDocument } from '../../domain/ports'
import { OrderTaxDocumentRepository } from './order-tax-document.repository'

describe('order tax document repository', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repository: OrderTaxDocumentRepository
  let tenantId: string
  let userId: string
  let eventId: string
  const orderIds: string[] = []

  const document = (overrides: Partial<CachedTaxDocument> = {}): CachedTaxDocument => ({
    id: randomUUID(),
    externalRef: 'ref',
    type: 'invoice',
    state: 'received',
    number: '001-001-000000001',
    accessKey: '1'.repeat(49),
    issueDate: '2026-11-03',
    authorizedAt: null,
    sriMessages: [{ identifier: '35', message: 'm', additionalInfo: null, type: 'ERROR' }],
    deliveries: [],
    syncedAt: null,
    ...overrides,
  })

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
          validate,
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [PrismaService, OrderTaxDocumentRepository],
    }).compile()
    prisma = module.get(PrismaService)
    repository = module.get(OrderTaxDocumentRepository)
    tenantId = (await prisma.tenant.create({ data: { name: 'Tax Doc Repo', is_platform: false } }))
      .id
    userId = (
      await prisma.user.create({
        data: { email: `taxdoc-${randomUUID()}@test.local`, password_hash: 'x' },
      })
    ).id
    eventId = (
      await prisma.event.create({
        data: {
          name: 'Tax Doc Event',
          slug: `tax-doc-${randomUUID()}`,
          start_date: new Date('2026-08-29'),
          end_date: new Date('2026-08-29'),
          event_type_id: (await prisma.eventType.findFirstOrThrow()).id,
          tenant_id: tenantId,
          photo_quota: 10,
          photos_uploaded: 0,
        },
      })
    ).id
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.orderTaxDocument.deleteMany({ where: { order_id: { in: orderIds } } })
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
      await prisma.event.deleteMany({ where: { id: eventId } })
      await prisma.user.deleteMany({ where: { id: userId } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  const newOrder = async () => {
    const order = await prisma.order.create({ data: { event_id: eventId, user_id: userId } })
    orderIds.push(order.id)
    return order.id
  }

  it('replaces a cached document by its rikuchiy id', async () => {
    const orderId = await newOrder()
    const first = document()

    await repository.upsertMany(orderId, [first], new Date('2026-11-03T15:00:00Z'))
    await repository.upsertMany(
      orderId,
      [
        {
          ...first,
          state: 'authorized',
          authorizedAt: new Date('2026-11-03T15:00:00Z'),
          sriMessages: [],
        },
      ],
      new Date('2026-11-03T15:05:00Z'),
    )

    const found = await repository.findByOrder(orderId)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      id: first.id,
      state: 'authorized',
      issueDate: '2026-11-03',
      sriMessages: [],
    })
    expect(found[0].authorizedAt?.toISOString()).toBe('2026-11-03T15:00:00.000Z')
    expect(found[0].syncedAt?.toISOString()).toBe('2026-11-03T15:05:00.000Z')
  })

  it('keeps the documents of each order apart', async () => {
    const orderId = await newOrder()
    const otherOrderId = await newOrder()
    const syncedAt = new Date('2026-11-03T15:00:00Z')
    await repository.upsertMany(orderId, [document(), document({ type: 'credit_note' })], syncedAt)
    await repository.upsertMany(otherOrderId, [document()], syncedAt)

    expect(await repository.findByOrder(orderId)).toHaveLength(2)
    expect(await repository.findByOrder(otherOrderId)).toHaveLength(1)
  })
})
