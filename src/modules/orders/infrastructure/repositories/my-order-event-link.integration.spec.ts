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

type EventSetup = {
  status?: 'active' | 'completed' | 'archived' | 'frozen'
  deleted?: boolean
  assets: Array<'cover_image' | 'event_logo' | 'hero_image' | 'poster'>
}

/**
 * The buyer's order links back to its event's public gallery only while /gallery/:slug opens:
 * not deleted, active or completed, and with a cover. Checked against a real Postgres, where the cover is
 * counted inside the event query.
 */
describe('my orders: link to the event gallery', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repo: OrderReadRepository

  const runId = `link-${randomUUID().slice(0, 8)}`
  let tenantId: string
  let buyerId: string
  const eventIds: string[] = []
  const orderIds: Record<string, string> = {}
  const slugs: Record<string, string> = {}

  async function createEventWithOrder(key: string, setup: EventSetup) {
    const event = await prisma.event.create({
      data: {
        name: `Event ${runId} ${key}`,
        slug: `${runId}-${key}`.toLowerCase(),
        start_date: new Date('2026-11-01'),
        end_date: new Date('2026-11-01'),
        tenant_id: tenantId,
        event_type_id: (await prisma.eventType.findFirstOrThrow()).id,
        status: setup.status ?? 'active',
        deleted_at: setup.deleted ? new Date('2026-11-10') : null,
      },
    })
    eventIds.push(event.id)
    slugs[key] = event.slug
    for (const assetType of setup.assets) {
      const assetSlug = randomUUID().replace(/-/g, '').slice(0, 30)
      await prisma.eventAsset.create({
        data: {
          event_id: event.id,
          asset_type: assetType,
          storage_key: `events/${event.id}/${assetSlug}.jpg`,
          public_slug: assetSlug,
        },
      })
    }
    const order = await prisma.order.create({
      data: {
        event_id: event.id,
        user_id: buyerId,
        status: 'pending',
        payment_method: 'transfer',
        subtotal: '8.00',
        snap_currency: 'USD',
      },
    })
    orderIds[key] = order.id
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

    tenantId = (
      await prisma.tenant.create({ data: { name: `Tenant ${runId}`, is_platform: false } })
    ).id
    buyerId = (
      await prisma.user.create({ data: { email: `${runId}@example.com`, password_hash: 'x' } })
    ).id

    await createEventWithOrder('listed', { assets: ['cover_image', 'event_logo'] })
    await createEventWithOrder('noCover', { assets: ['event_logo', 'hero_image', 'poster'] })
    await createEventWithOrder('completed', { status: 'completed', assets: ['cover_image'] })
    await createEventWithOrder('deleted', { deleted: true, assets: ['cover_image'] })
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.order.deleteMany({ where: { id: { in: Object.values(orderIds) } } })
      await prisma.eventAsset.deleteMany({ where: { event_id: { in: eventIds } } })
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } })
      if (buyerId) await prisma.user.deleteMany({ where: { id: buyerId } })
      if (tenantId) await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) await module.close()
  })

  it('gives the slug of an active event with a cover, and the payment method', async () => {
    const detail = await repo.getMyDetail(buyerId, orderIds.listed)

    expect(detail).toMatchObject({ eventSlug: slugs.listed, paymentMethod: 'transfer' })
  })

  it.each([
    'noCover',
    'deleted',
  ])('gives no slug when the gallery would answer 404 (%s)', async (key) => {
    expect((await repo.getMyDetail(buyerId, orderIds[key]))?.eventSlug).toBeNull()
  })

  it('gives the slug of a completed event with a cover: its gallery stays open', async () => {
    expect((await repo.getMyDetail(buyerId, orderIds.completed))?.eventSlug).toBe(slugs.completed)
  })

  it('gives every order of the list the same slug as its detail', async () => {
    const page = await repo.getMyList(buyerId, new Pagination(1, 50))

    const slugByOrder = new Map(page.items.map((item) => [item.id, item.eventSlug]))
    expect(
      Object.fromEntries(Object.entries(orderIds).map(([key, id]) => [key, slugByOrder.get(id)])),
    ).toEqual({ listed: slugs.listed, noCover: null, completed: slugs.completed, deleted: null })
    expect(page.items.every((item) => item.paymentMethod === 'transfer')).toBe(true)
  })
})
