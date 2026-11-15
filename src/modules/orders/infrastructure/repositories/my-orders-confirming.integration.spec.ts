import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { Pagination } from '@shared/application'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import { OrderReadRepository } from './order-read.repository'

const fakeCdn = {
  galleryUrl: (slug: string) => `https://cdn.test/gallery/${slug}.jpg`,
} as unknown as CdnUrlBuilder

type TransactionStatus =
  | 'initiated'
  | 'confirming'
  | 'approved'
  | 'declined'
  | 'expired'
  | 'reversed'

const MINUTE = 60_000

describe('my orders: card orders awaiting confirmation', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repo: OrderReadRepository

  const runId = `conf-${randomUUID().slice(0, 8)}`
  let tenantId: string
  let eventId: string
  let buyerId: string
  let otherBuyerId: string
  const orderIds: Record<string, string> = {}
  const transactionIds: string[] = []
  const clientTransactionIds: Record<string, string> = {}

  async function createOrder(key: string, userId: string, status: 'draft' | 'pending' | 'paid') {
    const order = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: userId,
        status,
        subtotal: '8.00',
        snap_currency: 'USD',
        payment_method: status === 'pending' ? 'transfer' : 'card',
      },
    })
    orderIds[key] = order.id
    return order.id
  }

  async function createTransaction(
    key: string,
    status: TransactionStatus,
    minutesSinceUpdate: number,
    orderKeys: string[],
  ) {
    const updatedAt = new Date(Date.now() - minutesSinceUpdate * MINUTE)
    const clientTransactionId = `tt-${runId}-${key}`.slice(0, 50)
    const transaction = await prisma.paymentTransaction.create({
      data: {
        client_transaction_id: clientTransactionId,
        provider: 'payphone',
        status,
        amount_cents: 800,
        amount_without_tax_cents: 800,
        amount_with_tax_cents: 0,
        tax_cents: 0,
        commission_cents: 40,
        mode_snapshot: 'split_receiver',
        receiver_snapshot: '0991234567',
        created_at: updatedAt,
        updated_at: updatedAt,
        orders: { create: orderKeys.map((orderKey) => ({ order_id: orderIds[orderKey] })) },
      },
    })
    transactionIds.push(transaction.id)
    clientTransactionIds[key] = clientTransactionId
  }

  async function listed() {
    const page = await repo.getMyList(buyerId, new Pagination(1, 50))
    return new Map(page.items.map((item) => [item.id, item.state]))
  }

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
      providers: [PrismaService],
    }).compile()

    prisma = module.get(PrismaService)
    repo = new OrderReadRepository(prisma, fakeCdn)

    const eventType = await prisma.eventType.findFirstOrThrow()
    const tenant = await prisma.tenant.create({
      data: { name: `Tenant ${runId}`, is_platform: false },
    })
    tenantId = tenant.id
    const event = await prisma.event.create({
      data: {
        name: `Event ${runId}`,
        slug: `event-${runId}`,
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-01-02'),
        tenant_id: tenant.id,
        event_type_id: eventType.id,
      },
    })
    eventId = event.id

    const createUser = async (key: string) =>
      (
        await prisma.user.create({
          data: { email: `${runId}-${key}@example.com`, password_hash: 'x' },
        })
      ).id
    buyerId = await createUser('buyer')
    otherBuyerId = await createUser('other')

    await createOrder('transferPending', buyerId, 'pending')
    await createOrder('paid', buyerId, 'paid')

    await createOrder('confirmingNow', buyerId, 'draft')
    await createTransaction('confirmingNow', 'confirming', 1, ['confirmingNow'])

    await createOrder('confirmingAlmostStale', buyerId, 'draft')
    await createTransaction('confirmingAlmostStale', 'confirming', 29, ['confirmingAlmostStale'])

    await createOrder('confirmingStale', buyerId, 'draft')
    await createTransaction('confirmingStale', 'confirming', 31, ['confirmingStale'])

    await createOrder('approvedUnsettled', buyerId, 'draft')
    await createTransaction('approvedUnsettled', 'approved', 3, ['approvedUnsettled'])

    await createOrder('approvedUnsettledLongAgo', buyerId, 'draft')
    await createTransaction('approvedUnsettledLongAgo', 'approved', 120, [
      'approvedUnsettledLongAgo',
    ])

    await createOrder('initiated', buyerId, 'draft')
    await createTransaction('initiated', 'initiated', 1, ['initiated'])

    await createOrder('declined', buyerId, 'draft')
    await createTransaction('declined', 'declined', 1, ['declined'])

    await createOrder('expired', buyerId, 'draft')
    await createTransaction('expired', 'expired', 1, ['expired'])

    await createOrder('reversed', buyerId, 'draft')
    await createTransaction('reversed', 'reversed', 1, ['reversed'])

    await createOrder('noTransaction', buyerId, 'draft')

    // An earlier attempt that expired plus a fresh one being confirmed, on the same order.
    await createOrder('retried', buyerId, 'draft')
    await createTransaction('retriedFirstAttempt', 'expired', 20, ['retried'])
    await createTransaction('retried', 'confirming', 2, ['retried'])

    await createOrder('groupA', buyerId, 'draft')
    await createOrder('groupB', buyerId, 'draft')
    await createTransaction('group', 'confirming', 1, ['groupA', 'groupB'])

    await createOrder('someoneElse', otherBuyerId, 'draft')
    await createTransaction('someoneElse', 'confirming', 1, ['someoneElse'])
  })

  afterAll(async () => {
    if (prisma) {
      const ids = Object.values(orderIds)
      await prisma.paymentTransactionOrder.deleteMany({ where: { order_id: { in: ids } } })
      await prisma.paymentTransaction.deleteMany({ where: { id: { in: transactionIds } } })
      await prisma.order.deleteMany({ where: { id: { in: ids } } })
      if (eventId) await prisma.event.deleteMany({ where: { id: eventId } })
      await prisma.user.deleteMany({
        where: { id: { in: [buyerId, otherBuyerId].filter(Boolean) } },
      })
      if (tenantId) await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  describe('getMyList', () => {
    it('shows a draft whose transaction is being confirmed, as confirming', async () => {
      const orders = await listed()

      expect(orders.get(orderIds.confirmingNow)).toBe('confirming')
      expect(orders.get(orderIds.confirmingAlmostStale)).toBe('confirming')
    })

    it('stops showing it once the confirmation has been silent for more than thirty minutes', async () => {
      expect((await listed()).has(orderIds.confirmingStale)).toBe(false)
    })

    it('shows a draft whose payment was approved but not settled, however long ago', async () => {
      const orders = await listed()

      expect(orders.get(orderIds.approvedUnsettled)).toBe('confirming')
      expect(orders.get(orderIds.approvedUnsettledLongAgo)).toBe('confirming')
    })

    it.each([
      'initiated',
      'declined',
      'expired',
      'reversed',
      'noTransaction',
    ])('keeps hiding an abandoned draft (%s)', async (key) => {
      expect((await listed()).has(orderIds[key])).toBe(false)
    })

    it('goes by the attempt being confirmed, not by an earlier one that expired', async () => {
      expect((await listed()).get(orderIds.retried)).toBe('confirming')
    })

    it('shows every order a single transaction covers', async () => {
      const orders = await listed()

      expect(orders.get(orderIds.groupA)).toBe('confirming')
      expect(orders.get(orderIds.groupB)).toBe('confirming')
    })

    it('never shows another buyer their order', async () => {
      expect((await listed()).has(orderIds.someoneElse)).toBe(false)

      const theirs = await repo.getMyList(otherBuyerId, new Pagination(1, 50))
      expect(theirs.items.map((item) => item.id)).toEqual([orderIds.someoneElse])
    })

    it('leaves the other states as they were', async () => {
      const orders = await listed()

      expect(orders.get(orderIds.transferPending)).toBe('in_process')
      expect(orders.get(orderIds.paid)).toBe('ready')
    })

    it('counts exactly the rows it returns', async () => {
      const page = await repo.getMyList(buyerId, new Pagination(1, 50))

      expect(page.total).toBe(page.items.length)
      expect(page.total).toBe(9)

      const firstPage = await repo.getMyList(buyerId, new Pagination(1, 4))
      expect(firstPage.total).toBe(9)
      expect(firstPage.items).toHaveLength(4)
    })
  })

  describe('getMyDetail', () => {
    it('describes an order being confirmed: nothing to cancel or download, and which transaction', async () => {
      const detail = await repo.getMyDetail(buyerId, orderIds.confirmingNow)

      expect(detail).toMatchObject({
        id: orderIds.confirmingNow,
        state: 'confirming',
        canCancel: false,
        canDownload: false,
        confirmingTransactionId: clientTransactionIds.confirmingNow,
      })
    })

    it('names the attempt being confirmed when an earlier one expired', async () => {
      const detail = await repo.getMyDetail(buyerId, orderIds.retried)

      expect(detail?.confirmingTransactionId).toBe(clientTransactionIds.retried)
    })

    it('names the approved transaction of an order still to be settled', async () => {
      const detail = await repo.getMyDetail(buyerId, orderIds.approvedUnsettledLongAgo)

      expect(detail).toMatchObject({
        state: 'confirming',
        confirmingTransactionId: clientTransactionIds.approvedUnsettledLongAgo,
      })
    })

    it.each([
      'confirmingStale',
      'initiated',
      'declined',
      'expired',
      'noTransaction',
    ])('finds nothing for an abandoned draft (%s)', async (key) => {
      expect(await repo.getMyDetail(buyerId, orderIds[key])).toBeNull()
    })

    it('finds nothing for an order being confirmed that belongs to someone else', async () => {
      expect(await repo.getMyDetail(buyerId, orderIds.someoneElse)).toBeNull()
    })

    it('carries no transaction on an order that is not being confirmed', async () => {
      const detail = await repo.getMyDetail(buyerId, orderIds.transferPending)

      expect(detail).toMatchObject({
        state: 'in_process',
        canCancel: true,
        confirmingTransactionId: null,
      })
    })
  })

  describe('existsVisibleToOwner', () => {
    it('is true for what the buyer can see, an order being confirmed included', async () => {
      expect(await repo.existsVisibleToOwner(buyerId, orderIds.confirmingNow)).toBe(true)
      expect(await repo.existsVisibleToOwner(buyerId, orderIds.paid)).toBe(true)
    })

    it('is false for abandoned drafts and for other buyers', async () => {
      expect(await repo.existsVisibleToOwner(buyerId, orderIds.initiated)).toBe(false)
      expect(await repo.existsVisibleToOwner(buyerId, orderIds.confirmingStale)).toBe(false)
      expect(await repo.existsVisibleToOwner(buyerId, orderIds.someoneElse)).toBe(false)
    })
  })

  describe('what must not change', () => {
    it('keeps an order being confirmed out of existsOwnedBy, which gates billing corrections', async () => {
      expect(await repo.existsOwnedBy(buyerId, orderIds.confirmingNow)).toBe(false)
      expect(await repo.existsOwnedBy(buyerId, orderIds.approvedUnsettled)).toBe(false)
      expect(await repo.existsOwnedBy(buyerId, orderIds.paid)).toBe(true)
    })

    it('keeps orders being confirmed out of the summary', async () => {
      const summary = await repo.getMySummary(buyerId)

      expect(summary.orderCount).toBe(2)
      expect(summary.spent).toEqual([{ currency: 'USD', amount: '8' }])
    })

    it('keeps them out of the downloads', async () => {
      expect(await repo.getMyDownloadFiles(buyerId, orderIds.confirmingNow)).toBeNull()
    })
  })
})
