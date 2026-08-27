import { randomUUID } from 'node:crypto'
import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import { UserReadRepository } from './user-read.repository'

// Exercises the real SQL behind the "Compradores" screen: getBuyersList's three raw sorts across a
// page boundary, getBuyersStats' single-round-trip aggregate, and the money/order status rules
// (gifted counts as an order but never as money; cancelled counts as neither). No prior test in this
// repo has ever run this SQL against a real database — the unit spec only asserts SQL shape.
describe('UserReadRepository buyers SQL', () => {
  let module: TestingModule
  let prisma: PrismaService
  let repo: UserReadRepository

  // Every fixture email carries this run id, and every query below filters on it via `search`, so
  // this spec is isolated from whatever else lives in the shared dev database.
  const runId = `buyers-it-${randomUUID().slice(0, 8)}`

  let tenantId: string
  let eventId: string
  let customerRoleId: string
  let countryId: number
  let provinceId: number
  let thirtyYearsAgo: Date
  const registeredAt = new Date('2026-01-15T12:00:00.000Z')
  const buyerIds: Record<string, string> = {}

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
    repo = new UserReadRepository(prisma)

    const tenant = await prisma.tenant.create({
      data: { name: `Buyers IT Tenant ${runId}`, is_platform: false, public_name: 'Buyers IT' },
    })
    tenantId = tenant.id

    const eventType = await prisma.eventType.findFirstOrThrow()
    const event = await prisma.event.create({
      data: {
        name: `Buyers IT Event ${runId}`,
        slug: `buyers-it-${runId}`,
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-01-02'),
        tenant_id: tenantId,
        event_type_id: eventType.id,
      },
    })
    eventId = event.id

    const customerRole = await prisma.role.findFirstOrThrow({ where: { name: 'customer' } })
    customerRoleId = customerRole.id

    const day = (n: number) => new Date(`2026-02-0${n}T12:00:00.000Z`)

    async function createBuyer(
      key: string,
      orders: Array<{
        status: 'paid' | 'delivered' | 'gifted' | 'cancelled' | 'draft'
        subtotal: string
        createdAt: Date
      }>,
      category: 'sort' | 'other' = 'other',
    ) {
      const user = await prisma.user.create({
        data: {
          email: `${category}-${runId}-${key}@example.com`,
          password_hash: 'x',
        },
      })
      await prisma.userRole.create({ data: { user_id: user.id, role_id: customerRoleId } })

      await Promise.all(
        orders.map((order) =>
          prisma.order.create({
            data: {
              event_id: eventId,
              user_id: user.id,
              status: order.status,
              subtotal: order.subtotal,
              created_at: order.createdAt,
            },
          }),
        ),
      )

      buyerIds[key] = user.id
    }

    // Sort fixtures, tagged with the "sort" email category so the page-boundary tests below can
    // scope to exactly these three via `search`. Two buyers tie on spent (30.00) to prove the id
    // tiebreaker; order_count and last_purchase are all distinct across the three.
    await createBuyer(
      'buyer1',
      [
        { status: 'paid', subtotal: '10.00', createdAt: day(1) },
        { status: 'delivered', subtotal: '20.00', createdAt: day(3) },
      ],
      'sort',
    )
    await createBuyer('buyer2', [{ status: 'paid', subtotal: '30.00', createdAt: day(2) }], 'sort')
    await createBuyer(
      'buyer3',
      [
        { status: 'paid', subtotal: '4.00', createdAt: day(1) },
        { status: 'paid', subtotal: '3.00', createdAt: day(1) },
        { status: 'delivered', subtotal: '3.00', createdAt: day(1) },
      ],
      'sort',
    )

    // Money-status fixtures.
    await createBuyer('gifted-only', [{ status: 'gifted', subtotal: '999.00', createdAt: day(1) }])
    await createBuyer('cancelled-only', [
      { status: 'cancelled', subtotal: '500.00', createdAt: day(1) },
    ])
    await createBuyer('draft-only', [{ status: 'draft', subtotal: '1.00', createdAt: day(1) }])
    await createBuyer('never-buyer', [])

    // The filter fixtures hang off `never-buyer` on purpose: attaching them to an existing buyer
    // keeps every tab count below untouched while giving the profile/phone/date filters something
    // real to match. `birth_date` is derived from today so the age window never goes stale.
    const country = await prisma.country.findFirstOrThrow()
    const province = await prisma.province.findFirstOrThrow({ where: { country_id: country.id } })
    countryId = country.id
    provinceId = province.id
    const today = new Date()
    thirtyYearsAgo = new Date(
      Date.UTC(today.getUTCFullYear() - 30, today.getUTCMonth(), today.getUTCDate()),
    )

    await prisma.customerProfile.create({
      data: {
        user_id: buyerIds['never-buyer'],
        country_id: countryId,
        province_id: provinceId,
        gender: 'female',
        birth_date: thirtyYearsAgo,
      },
    })
    await prisma.userPhone.create({
      data: {
        user_id: buyerIds['never-buyer'],
        phone_number: '0999000111',
        is_primary: true,
        is_whatsapp: true,
      },
    })
    await prisma.user.update({
      where: { id: buyerIds['never-buyer'] },
      data: { email_verified_at: new Date(), created_at: registeredAt },
    })

    // `draft-only` carries a primary phone that is NOT WhatsApp plus a WhatsApp phone that is NOT
    // primary. A `hasWhatsapp: true` filter that allows the two conditions to land on different
    // rows would wrongly match this buyer.
    await prisma.userPhone.createMany({
      data: [
        {
          user_id: buyerIds['draft-only'],
          phone_number: '0999000222',
          is_primary: true,
          is_whatsapp: false,
        },
        {
          user_id: buyerIds['draft-only'],
          phone_number: '0999000333',
          is_primary: false,
          is_whatsapp: true,
        },
      ],
    })
  })

  afterAll(async () => {
    if (prisma) {
      const userIds = Object.values(buyerIds)
      await prisma.order.deleteMany({ where: { user_id: { in: userIds } } })
      await prisma.userPhone.deleteMany({ where: { user_id: { in: userIds } } })
      await prisma.customerProfile.deleteMany({ where: { user_id: { in: userIds } } })
      await prisma.userRole.deleteMany({ where: { user_id: { in: userIds } } })
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
      await prisma.event.deleteMany({ where: { id: eventId } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
      await prisma.$disconnect()
    }
    if (module) {
      await module.close()
    }
  })

  describe.each([
    { sort: 'orders' as const, descendingKeys: ['buyer3', 'buyer1', 'buyer2'] },
    { sort: 'last_purchase' as const, descendingKeys: ['buyer1', 'buyer2', 'buyer3'] },
  ])('the "$sort" raw sort', ({ sort, descendingKeys }) => {
    it('orders buyer1/buyer2/buyer3 as expected and keeps a stable total order across a page boundary', async () => {
      const filters = { search: `sort-${runId}`, sort }
      const fullPage = await repo.getBuyersList(new Pagination(1, 10), filters)
      expect(fullPage.total).toBe(3)
      expect(fullPage.items.map((item) => item.id)).toEqual(
        descendingKeys.map((key) => buyerIds[key as keyof typeof buyerIds]),
      )

      const firstPage = await repo.getBuyersList(new Pagination(1, 2), filters)
      const secondPage = await repo.getBuyersList(new Pagination(2, 2), filters)

      expect(firstPage.total).toBe(fullPage.total)
      expect(secondPage.total).toBe(fullPage.total)

      const paginatedIds = [...firstPage.items, ...secondPage.items].map((item) => item.id)
      expect(paginatedIds).toEqual(fullPage.items.map((item) => item.id))
      expect(new Set(paginatedIds).size).toBe(paginatedIds.length)
    })
  })

  it('breaks a tied "spent" sort on id, so the tiebreaker is a real total order across a page boundary', async () => {
    // buyer1 and buyer2 both total 30.00; only the id tiebreaker keeps their relative order stable.
    const filters = { search: `sort-${runId}`, sort: 'spent' as const }
    const fullPage = await repo.getBuyersList(new Pagination(1, 10), filters)
    expect(fullPage.total).toBe(3)
    expect(fullPage.items.map((item) => item.spent)).toEqual(['30.00', '30.00', '10.00'])
    const tiedPairSortedById = [buyerIds.buyer1, buyerIds.buyer2].sort()
    expect(fullPage.items.slice(0, 2).map((item) => item.id)).toEqual(tiedPairSortedById)

    const firstPage = await repo.getBuyersList(new Pagination(1, 2), filters)
    const secondPage = await repo.getBuyersList(new Pagination(2, 2), filters)

    expect(firstPage.total).toBe(fullPage.total)
    expect(secondPage.total).toBe(fullPage.total)
    const paginatedIds = [...firstPage.items, ...secondPage.items].map((item) => item.id)
    expect(paginatedIds).toEqual(fullPage.items.map((item) => item.id))
    expect(new Set(paginatedIds).size).toBe(paginatedIds.length)
  })

  it('never lets a gifted order count as money, even though it counts as an order', async () => {
    const { items } = await repo.getBuyersList(new Pagination(1, 10), { search: runId })
    const gifted = items.find((item) => item.id === buyerIds['gifted-only'])

    expect(gifted?.orderCount).toBe(1)
    expect(gifted?.spent).toBe('0.00')
  })

  it('counts a cancelled order as neither money nor unpaid, only as an order', async () => {
    const { items } = await repo.getBuyersList(new Pagination(1, 10), { search: runId })
    const cancelled = items.find((item) => item.id === buyerIds['cancelled-only'])

    expect(cancelled?.orderCount).toBe(1)
    expect(cancelled?.spent).toBe('0.00')
    expect(cancelled?.unpaidCount).toBe(0)
  })

  it('excludes a draft-only buyer from every purchase tab except "never"', async () => {
    const bought = await repo.getBuyersList(new Pagination(1, 10), {
      search: runId,
      purchase: 'bought',
    })
    const never = await repo.getBuyersList(new Pagination(1, 10), {
      search: runId,
      purchase: 'never',
    })

    expect(bought.items.map((item) => item.id)).not.toContain(buyerIds['draft-only'])
    expect(never.items.map((item) => item.id)).toContain(buyerIds['draft-only'])
  })

  it('resolves "recurrent" as the buyers with two or more non-draft orders, scoped to the filtered set', async () => {
    const { items } = await repo.getBuyersList(new Pagination(1, 10), {
      search: runId,
      purchase: 'recurrent',
    })

    expect(items.map((item) => item.id).sort()).toEqual([buyerIds.buyer1, buyerIds.buyer3].sort())
  })

  // Every filter below reaches Postgres as raw SQL — a `::gender` cast, a `date` compared against a
  // `timestamptz`, an `EXISTS` over phones. None of it is exercised by the unit spec, which only
  // greps the generated SQL text, so a runtime cast or operator error would otherwise ship unseen.
  describe('the filter predicates, against real rows', () => {
    const onlyNeverBuyer = async (filters: Record<string, unknown>) => {
      const { items } = await repo.getBuyersList(new Pagination(1, 10), {
        search: runId,
        ...filters,
      })
      return items.map((item) => item.id)
    }

    it('matches on country and on province', async () => {
      expect(await onlyNeverBuyer({ countryId })).toEqual([buyerIds['never-buyer']])
      expect(await onlyNeverBuyer({ countryId, provinceId })).toEqual([buyerIds['never-buyer']])
    })

    it('matches on gender, casting the value to the enum', async () => {
      expect(await onlyNeverBuyer({ gender: 'female' })).toEqual([buyerIds['never-buyer']])
      expect(await onlyNeverBuyer({ gender: 'male' })).toEqual([])
    })

    it('matches on an age window and excludes one that does not bracket the birth date', async () => {
      expect(await onlyNeverBuyer({ ageFrom: 29, ageTo: 31 })).toEqual([buyerIds['never-buyer']])
      expect(await onlyNeverBuyer({ ageFrom: 60, ageTo: 70 })).toEqual([])
    })

    it('matches on a registration date range', async () => {
      const inRange = {
        registeredFrom: new Date('2026-01-14T00:00:00.000Z'),
        registeredTo: new Date('2026-01-16T23:59:59.999Z'),
      }
      expect(await onlyNeverBuyer(inRange)).toEqual([buyerIds['never-buyer']])
      expect(
        await onlyNeverBuyer({
          registeredFrom: new Date('2026-01-01T00:00:00.000Z'),
          registeredTo: new Date('2026-01-10T23:59:59.999Z'),
        }),
      ).toEqual([])
    })

    it('matches on email verification, both ways', async () => {
      expect(await onlyNeverBuyer({ emailVerified: true })).toEqual([buyerIds['never-buyer']])
      expect(await onlyNeverBuyer({ emailVerified: false })).not.toContain(buyerIds['never-buyer'])
    })

    it('requires the primary phone itself to be the WhatsApp one', async () => {
      // draft-only has both a primary phone and a WhatsApp phone, but never on the same row.
      const withWhatsapp = await onlyNeverBuyer({ hasWhatsapp: true })
      expect(withWhatsapp).toEqual([buyerIds['never-buyer']])
      expect(withWhatsapp).not.toContain(buyerIds['draft-only'])
    })
  })

  it('reports the right total for a page past the last row, where the window count returns nothing', async () => {
    const past = await repo.getBuyersList(new Pagination(50, 10), { search: runId })
    expect(past.items).toEqual([])
    expect(past.total).toBe(7)

    const pastRecurrent = await repo.getBuyersList(new Pagination(50, 10), {
      search: runId,
      purchase: 'recurrent',
    })
    expect(pastRecurrent.items).toEqual([])
    expect(pastRecurrent.total).toBe(2)
  })

  it('sums money over paid and delivered only, so gifted and cancelled never move the average ticket', async () => {
    // Money orders in the fixture set: buyer1 10.00 + 20.00, buyer2 30.00, buyer3 4.00 + 3.00 +
    // 3.00 — six orders totalling 70.00. The gifted 999.00 and cancelled 500.00 must not appear.
    const stats = await repo.getBuyersStats({ search: runId })

    expect(stats.averageTicket).toBe('11.67')
  })

  it('sums the tab counts consistently and keeps recurrent within bought', async () => {
    const stats = await repo.getBuyersStats({ search: runId })

    expect(stats.tabs.all).toBe(7)
    expect(stats.tabs.bought + stats.tabs.never).toBe(stats.tabs.all)
    expect(stats.tabs.bought).toBe(5)
    expect(stats.tabs.never).toBe(2)
    expect(stats.tabs.recurrent).toBe(2)
    expect(stats.tabs.recurrent).toBeLessThanOrEqual(stats.tabs.bought)
    expect(stats.totalBuyers).toBe(stats.tabs.all)
  })
})
