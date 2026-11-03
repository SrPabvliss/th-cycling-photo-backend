import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import type { RikuchiyEmissionPayload } from '../../domain/rikuchiy-emission-payload'
import { RikuchiyOutboxRepository } from './rikuchiy-outbox.repository'

describe('rikuchiy outbox repository', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repository: RikuchiyOutboxRepository
  let tenantId: string
  let userId: string
  let eventId: string
  const orderIds: string[] = []

  const payload = (orderId: string) =>
    ({
      emissionId: 'x',
      sale: { app: 'cycling-photo', externalRef: orderId },
    }) as unknown as RikuchiyEmissionPayload

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
      providers: [PrismaService, RikuchiyOutboxRepository],
    }).compile()

    prisma = module.get(PrismaService)
    repository = module.get(RikuchiyOutboxRepository)
    tenantId = (
      await prisma.tenant.create({ data: { name: 'Rikuchiy Outbox', is_platform: false } })
    ).id
    userId = (
      await prisma.user.create({
        data: { email: `outbox-${randomUUID()}@test.local`, password_hash: 'x' },
      })
    ).id
    eventId = (
      await prisma.event.create({
        data: {
          name: 'Outbox Event',
          slug: `rikuchiy-outbox-${randomUUID()}`,
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
      await prisma.rikuchiyOutboxItem.deleteMany({ where: { order_id: { in: orderIds } } })
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
      await prisma.event.deleteMany({ where: { id: eventId } })
      await prisma.user.deleteMany({ where: { id: userId } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  async function enqueueForNewOrder(): Promise<string> {
    const order = await prisma.order.create({ data: { event_id: eventId, user_id: userId } })
    orderIds.push(order.id)
    await prisma.$transaction((tx) =>
      repository.enqueue(
        { orderId: order.id, emissionId: randomUUID(), payload: payload(order.id) },
        tx,
      ),
    )
    return order.id
  }

  const rowOf = (orderId: string) =>
    prisma.rikuchiyOutboxItem.findFirstOrThrow({ where: { order_id: orderId } })

  it('hands out pending emissions oldest first', async () => {
    const first = await enqueueForNewOrder()
    const second = await enqueueForNewOrder()

    const pending = (await repository.findPending(500)).filter((item) =>
      [first, second].includes(item.orderId),
    )

    expect(pending.map((item) => item.orderId)).toEqual([first, second])
    expect(pending[0].payload.sale.externalRef).toBe(first)
  })

  it('records a sent emission with its tax document and stops handing it out', async () => {
    const orderId = await enqueueForNewOrder()
    const { id } = await rowOf(orderId)
    const taxDocumentId = randomUUID()

    await repository.markSent(id, taxDocumentId)

    const row = await rowOf(orderId)
    expect(row.status).toBe('sent')
    expect(row.tax_document_id).toBe(taxDocumentId)
    expect(row.sent_at).toBeInstanceOf(Date)
    expect((await repository.findPending(500)).some((item) => item.id === id)).toBe(false)
  })

  it('keeps a failed attempt pending and counts it', async () => {
    const orderId = await enqueueForNewOrder()
    const { id } = await rowOf(orderId)

    await repository.markAttemptFailed(id, '500 INTERNAL: boom')

    const row = await rowOf(orderId)
    expect(row.status).toBe('pending')
    expect(row.attempts).toBe(1)
    expect(row.last_error).toBe('500 INTERNAL: boom')
  })

  it('records a rejection with its reason', async () => {
    const orderId = await enqueueForNewOrder()
    const { id } = await rowOf(orderId)

    await repository.markRejected(id, `422 BUSINESS_RULE: ${'x'.repeat(400)}`)

    const row = await rowOf(orderId)
    expect(row.status).toBe('rejected')
    expect(row.rejection_reason?.length).toBe(300)
  })

  it('does not mark as sent an emission suppressed while it was in flight', async () => {
    const orderId = await enqueueForNewOrder()
    const { id } = await rowOf(orderId)
    await prisma.$transaction((tx) => repository.suppressPending(orderId, tx))

    const marked = await repository.markSent(id, randomUUID())

    expect(marked).toBe(false)
    expect((await rowOf(orderId)).status).toBe('suppressed')
  })

  it('revives a suppressed emission when the order becomes a sale again', async () => {
    const orderId = await enqueueForNewOrder()
    await prisma.$transaction((tx) => repository.suppressPending(orderId, tx))
    const emissionId = randomUUID()

    await prisma.$transaction((tx) =>
      repository.enqueue({ orderId, emissionId, payload: payload(orderId) }, tx),
    )

    const rows = await prisma.rikuchiyOutboxItem.findMany({ where: { order_id: orderId } })
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('pending')
    expect(rows[0].emission_id).toBe(emissionId)
  })
})
