import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { ORDER_TABS } from '@orders/domain/ports'
import { OrderStatus } from '@orders/domain/value-objects/order-status.vo'
import { Pagination } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import { OrderReadRepository } from './order-read.repository'

const fakeCdn = {
  internalUrl: (slug: string, variant: string) => `https://cdn.test/${variant}/${slug}.jpg`,
} as CdnUrlBuilder

describe('OrderReadRepository orders SQL', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repo: OrderReadRepository
  let scope: EventScope

  const runId = `orders-it-${randomUUID().slice(0, 8)}`
  const email = (key: string) => `${runId}-${key}@example.com`

  const userIds: Record<string, string> = {}
  const orderIds: string[] = []
  let tenantId: string
  let eventId: string

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

    async function createUser(key: string) {
      const user = await prisma.user.create({
        data: {
          email: email(key),
          password_hash: 'x',
          first_name: 'Holder',
          last_name: key,
          tenant_id: tenant.id,
        },
      })
      userIds[key] = user.id
      return user.id
    }

    await createUser('buyer')
    await createUser('secondBuyer')
    await createUser('lonelyBuyer')

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

    scope = new EventScope(false, [tenantId], [])

    async function createOrder(
      key: string,
      overrides: {
        userKey: string
        status: string
        subtotal?: string
        paidAt?: Date
        deliveredAt?: Date
        cancelledAt?: Date
        snapFirstName?: string
      },
    ) {
      const order = await prisma.order.create({
        data: {
          event_id: eventId,
          user_id: userIds[overrides.userKey],
          status: overrides.status as never,
          subtotal: overrides.subtotal ?? null,
          snap_currency: overrides.subtotal ? 'USD' : null,
          snap_first_name: overrides.snapFirstName ?? `Snap-${key}`,
          snap_last_name: runId,
          paid_at: overrides.paidAt ?? null,
          delivered_at: overrides.deliveredAt ?? null,
          cancelled_at: overrides.cancelledAt ?? null,
        },
      })
      orderIds.push(order.id)
      return order.id
    }

    // pending: open, contributes to openAmount
    await createOrder('pending', {
      userKey: 'buyer',
      status: OrderStatus.PENDING,
      subtotal: '10.00',
    })
    // payment_info_sent: open, contributes to openAmount
    await createOrder('info', {
      userKey: 'buyer',
      status: OrderStatus.PAYMENT_INFO_SENT,
      subtotal: '17.00',
    })
    // paid, not yet delivered: counts toward awaitingDeliveryCount
    await createOrder('paid', {
      userKey: 'secondBuyer',
      status: OrderStatus.PAID,
      subtotal: '50.00',
      paidAt: new Date(),
    })
    // delivered: was paid, now delivered, out of awaitingDeliveryCount, counts toward revenue
    await createOrder('delivered', {
      userKey: 'secondBuyer',
      status: OrderStatus.DELIVERED,
      subtotal: '30.00',
      paidAt: new Date(),
      deliveredAt: new Date(),
    })
    // gifted, not yet delivered: counts toward awaitingDeliveryCount, never toward revenue
    await createOrder('giftedUndelivered', {
      userKey: 'lonelyBuyer',
      status: OrderStatus.GIFTED,
      subtotal: '25.00',
    })
    // gifted, already delivered: out of awaitingDeliveryCount, never toward revenue
    await createOrder('giftedDelivered', {
      userKey: 'lonelyBuyer',
      status: OrderStatus.GIFTED,
      subtotal: '25.00',
      deliveredAt: new Date(),
    })
    // cancelled: own tab only — excluded from default "Todos"/ALL
    await createOrder('cancelled', {
      userKey: 'buyer',
      status: OrderStatus.CANCELLED,
      subtotal: '12.00',
      cancelledAt: new Date(),
    })
    // draft: an abandoned cart, must never surface anywhere
    await createOrder('draft', {
      userKey: 'lonelyBuyer',
      status: OrderStatus.DRAFT,
    })
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
      await prisma.user.deleteMany({ where: { id: { in: Object.values(userIds) } } })
      await prisma.event.deleteMany({ where: { id: eventId } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })

      const ordersLeft = await prisma.order.count({
        where: { id: { in: Object.values(orderIds) } },
      })
      const usersLeft = await prisma.user.count({ where: { id: { in: Object.values(userIds) } } })
      const eventsLeft = await prisma.event.count({ where: { id: eventId } })
      expect(ordersLeft).toBe(0)
      expect(usersLeft).toBe(0)
      expect(eventsLeft).toBe(0)

      await prisma.$disconnect()
    }
    if (module) {
      await module.close()
    }
  })

  it('never surfaces a draft order in any tab or any figure, and Todos excludes cancelled', async () => {
    const all = await repo.getList(new Pagination(1, 100), { search: runId }, scope)
    expect(all.items.some((o) => o.status === 'draft')).toBe(false)
    expect(all.items.some((o) => o.status === 'cancelled')).toBe(false)
    expect(all.total).toBe(6)

    const stats = await repo.getStats({ search: runId }, scope)
    expect(stats.tabs.all).toBe(all.total)
    expect(stats.tabs.cancelled).toBe(1)
    expect(stats.totalOrders).toBe(7)
  })

  it('gives every tab a count equal to the rows that tab returns', async () => {
    const stats = await repo.getStats({ search: runId }, scope)
    const counted = await Promise.all(
      ORDER_TABS.map((t) =>
        repo.getList(new Pagination(1, 100), { status: t.status, search: runId }, scope),
      ),
    )
    expect(counted.map((p) => p.total)).toEqual(ORDER_TABS.map((t) => stats.tabs[t.id]))
  })

  it('counts a gifted order as awaiting delivery only until it is delivered', async () => {
    const stats = await repo.getStats({ search: runId }, scope)
    expect(stats.awaitingDeliveryCount).toBe(2)
  })

  it('sums openAmount over pending and payment_info_sent only, as a decimal string', async () => {
    const stats = await repo.getStats({ search: runId }, scope)
    expect(stats.openAmount).toBe('27.00')
  })

  it('does not move the tile figures when a status filter is applied', async () => {
    const all = await repo.getStats({ search: runId }, scope)
    const filtered = await repo.getStats({ search: runId, status: 'paid' }, scope)
    expect(filtered.openCount).toBe(all.openCount)
    expect(filtered.openAmount).toBe(all.openAmount)
  })

  it('keeps gifted money out of revenue, counting only paid and delivered', async () => {
    const stats = await repo.getStats({ search: runId }, scope)
    expect(stats.totalRevenue).toBe('80.00')
  })

  it('lists every non-draft order per customer, draft excluded even for its own buyer', async () => {
    const page = await repo.getList(new Pagination(1, 100), { search: runId }, scope)
    const buyerOrders = page.items.filter((o) => o.userId === userIds.buyer)
    const secondBuyerOrders = page.items.filter((o) => o.userId === userIds.secondBuyer)
    const lonelyOrders = page.items.filter((o) => o.userId === userIds.lonelyBuyer)
    expect(buyerOrders).toHaveLength(3)
    expect(secondBuyerOrders).toHaveLength(2)
    expect(lonelyOrders).toHaveLength(2)
  })
})
