import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { OrderReadRepository } from '@orders/infrastructure/repositories/order-read.repository'
import { Pagination } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../config/configuration'
import { validate } from '../../config/env.validation'

describe('orders list filtered by invoice state', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repository: OrderReadRepository
  let tenantId: string
  let userId: string
  let eventId: string
  const orderIds: Record<string, string> = {}

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
      providers: [
        PrismaService,
        OrderReadRepository,
        {
          provide: CdnUrlBuilder,
          useValue: { internalUrl: () => 'http://fake', galleryUrl: () => 'http://fake' },
        },
      ],
    }).compile()

    prisma = module.get(PrismaService)
    repository = module.get(OrderReadRepository)
    const tenant = await prisma.tenant.create({
      data: { name: 'Invoice Filter Tenant', is_platform: false, event_quota: 10 },
    })
    tenantId = tenant.id
    const user = await prisma.user.create({
      data: { email: `filter-buyer-${randomUUID()}@test.local`, password_hash: 'x' },
    })
    userId = user.id
    const event = await prisma.event.create({
      data: {
        name: 'Invoice Filter Event',
        slug: `invoice-filter-${randomUUID()}`,
        start_date: new Date('2026-08-29'),
        end_date: new Date('2026-08-29'),
        event_type_id: (await prisma.eventType.findFirstOrThrow()).id,
        tenant_id: tenant.id,
        photo_quota: 100,
        photos_uploaded: 0,
      },
    })
    eventId = event.id
    for (const state of ['none', 'in_process', 'rejected'] as const) {
      const order = await prisma.order.create({
        data: {
          event_id: eventId,
          user_id: userId,
          status: 'paid',
          payment_method: 'transfer',
          subtotal: '3.00',
          snap_email: 'juan@correo.com',
          invoice_state: state,
        },
      })
      orderIds[state] = order.id
    }
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.order.deleteMany({ where: { id: { in: Object.values(orderIds) } } })
      await prisma.event.deleteMany({ where: { id: eventId } })
      await prisma.user.deleteMany({ where: { id: userId } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  const scope = () => new EventScope(false, [], [eventId])
  const listIds = async (invoiceState?: string) => {
    const result = await repository.getList(new Pagination(1, 20), { invoiceState }, scope())
    return result.items.map((item) => item.id).sort()
  }

  it('filters orders by invoice state', async () => {
    expect(await listIds()).toHaveLength(3)
    expect(await listIds('rejected')).toEqual([orderIds.rejected])
    expect(await listIds('none')).toEqual([orderIds.none])
  })

  it('groups requested and in process together', async () => {
    const requested = await prisma.order.create({
      data: {
        event_id: eventId,
        user_id: userId,
        status: 'paid',
        payment_method: 'transfer',
        subtotal: '3.00',
        snap_email: 'juan@correo.com',
        invoice_state: 'requested',
      },
    })
    orderIds.requested = requested.id

    expect(await listIds('in_process')).toEqual([orderIds.in_process, orderIds.requested].sort())
  })

  it('narrows the stats the same way', async () => {
    const stats = await repository.getStats({ invoiceState: 'rejected' }, scope())
    expect(stats.tabs.all).toBe(1)
  })
})
