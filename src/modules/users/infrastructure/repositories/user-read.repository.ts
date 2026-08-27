import { type Gender, Prisma, RoleType } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PaginatedResult, type Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import type {
  BuyerDetailProjection,
  BuyerListProjection,
  BuyerOrderProjection,
  BuyersStatsProjection,
  MyProfileProjection,
  UserDetailProjection,
  UserListProjection,
} from '@users/application/projections'
import type { User } from '@users/domain/entities'
import type { BuyerListFilters, IUserReadRepository } from '@users/domain/ports'
import * as UserMapper from '../mappers/user.mapper'
import {
  type BuyerAggregate,
  buildBuyerAggregates,
  MONEY_STATUSES,
  toAverageTicket,
} from './buyer-aggregates'

const buyerSelectConfig = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  email_verified_at: true,
  is_active: true,
  last_login_at: true,
  created_at: true,
  phones: {
    where: { is_primary: true },
    select: { phone_number: true, is_whatsapp: true },
    take: 1,
  },
  customer_profile: {
    select: {
      country: { select: { name: true } },
      province: { select: { name: true } },
      canton: { select: { name: true } },
      birth_date: true,
      gender: true,
    },
  },
} satisfies Prisma.UserSelect

type BuyerRow = Prisma.UserGetPayload<{ select: typeof buyerSelectConfig }>

function subtractYears(date: Date, years: number): Date {
  const result = new Date(date)
  result.setFullYear(result.getFullYear() - years)
  return result
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

function ageToBirthDateRange(
  ageFrom?: number,
  ageTo?: number,
  now: Date = new Date(),
): Prisma.DateTimeFilter | undefined {
  if (ageFrom === undefined && ageTo === undefined) return undefined

  const range: Prisma.DateTimeFilter = {}
  if (ageFrom !== undefined) range.lte = subtractYears(now, ageFrom)
  if (ageTo !== undefined) range.gte = subtractYears(now, ageTo + 1)
  return range
}

function escapeLikeTerm(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

type BuyerSort = 'recent' | 'orders' | 'spent' | 'last_purchase'

function resolveBuyerSort(sort: string | undefined): BuyerSort {
  return sort === 'orders' || sort === 'spent' || sort === 'last_purchase' ? sort : 'recent'
}

function sortColumnSql(sort: BuyerSort): Prisma.Sql {
  if (sort === 'orders') return Prisma.sql`a.order_count`
  if (sort === 'spent') return Prisma.sql`a.spent`
  if (sort === 'last_purchase') return Prisma.sql`a.last_purchase`
  return Prisma.sql`c.created_at`
}

/** Builds the candidate-set predicate (every filter except "recurrent", which needs the order aggregate). */
function buildCandidatesWhereSql(filters: BuyerListFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = u.id AND r.name = 'customer'
    )`,
  ]

  if (filters.search) {
    const pattern = `%${escapeLikeTerm(filters.search)}%`
    conditions.push(Prisma.sql`(
      u.first_name ILIKE ${pattern} ESCAPE '\\' OR
      u.last_name ILIKE ${pattern} ESCAPE '\\' OR
      u.email ILIKE ${pattern} ESCAPE '\\' OR
      EXISTS (SELECT 1 FROM user_phones p WHERE p.user_id = u.id AND p.phone_number LIKE ${pattern} ESCAPE '\\')
    )`)
  }

  if (filters.purchase === 'bought') {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.status != 'draft')`,
    )
  } else if (filters.purchase === 'never') {
    conditions.push(
      Prisma.sql`NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.status != 'draft')`,
    )
  }

  if (filters.registeredFrom) conditions.push(Prisma.sql`u.created_at >= ${filters.registeredFrom}`)
  if (filters.registeredTo) conditions.push(Prisma.sql`u.created_at <= ${filters.registeredTo}`)

  if (filters.emailVerified === true) conditions.push(Prisma.sql`u.email_verified_at IS NOT NULL`)
  if (filters.emailVerified === false) conditions.push(Prisma.sql`u.email_verified_at IS NULL`)

  if (filters.hasWhatsapp === true) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM user_phones p WHERE p.user_id = u.id AND p.is_primary AND p.is_whatsapp)`,
    )
  } else if (filters.hasWhatsapp === false) {
    conditions.push(
      Prisma.sql`NOT EXISTS (SELECT 1 FROM user_phones p WHERE p.user_id = u.id AND p.is_primary AND p.is_whatsapp)`,
    )
  }

  const profileConditions: Prisma.Sql[] = []
  if (filters.countryId !== undefined)
    profileConditions.push(Prisma.sql`cp.country_id = ${filters.countryId}`)
  if (filters.provinceId !== undefined)
    profileConditions.push(Prisma.sql`cp.province_id = ${filters.provinceId}`)
  if (filters.gender)
    profileConditions.push(Prisma.sql`cp.gender = ${filters.gender as Gender}::gender`)

  const birthDateRange = ageToBirthDateRange(filters.ageFrom, filters.ageTo)
  if (birthDateRange?.lte)
    profileConditions.push(Prisma.sql`cp.birth_date <= ${birthDateRange.lte}`)
  if (birthDateRange?.gte)
    profileConditions.push(Prisma.sql`cp.birth_date >= ${birthDateRange.gte}`)

  if (profileConditions.length > 0) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM customer_profiles cp
      WHERE cp.user_id = u.id AND ${Prisma.join(profileConditions, ' AND ')}
    )`)
  }

  return Prisma.join(conditions, ' AND ')
}

const buyerOrderSelectConfig = {
  id: true,
  status: true,
  payment_method: true,
  subtotal: true,
  created_at: true,
  event: { select: { name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect

type BuyerOrderRow = Prisma.OrderGetPayload<{ select: typeof buyerOrderSelectConfig }>

const buyerConsentSelectConfig = {
  type: true,
  policy_version: true,
  accepted_at: true,
} satisfies Prisma.UserConsentSelect

type BuyerConsentRow = Prisma.UserConsentGetPayload<{ select: typeof buyerConsentSelectConfig }>

function toBuyerOrderProjection(row: BuyerOrderRow): BuyerOrderProjection {
  return {
    id: row.id,
    eventName: row.event.name,
    date: row.created_at,
    photoCount: row._count.items,
    amount: new Prisma.Decimal(row.subtotal ?? 0).toFixed(2),
    paymentMethod: row.payment_method,
    status: row.status,
  }
}

function toBuyerListProjection(row: BuyerRow, aggregate: BuyerAggregate): BuyerListProjection {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    emailVerified: row.email_verified_at !== null,
    primaryPhone: row.phones[0]?.phone_number ?? null,
    isWhatsapp: row.phones[0]?.is_whatsapp ?? false,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    countryName: row.customer_profile?.country?.name ?? null,
    provinceName: row.customer_profile?.province?.name ?? null,
    cityName: row.customer_profile?.canton?.name ?? null,
    birthDate: row.customer_profile?.birth_date ?? null,
    gender: row.customer_profile?.gender ?? null,
    orderCount: aggregate.orderCount,
    spent: aggregate.spent,
    photoCount: aggregate.photoCount,
    eventCount: aggregate.eventCount,
    eventNames: aggregate.eventNames,
    firstOrderAt: aggregate.firstOrderAt,
    lastOrderAt: aggregate.lastOrderAt,
    unpaidCount: aggregate.unpaidCount,
    createdAt: row.created_at,
  }
}

@Injectable()
export class UserReadRepository implements IUserReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: { id },
      include: { user_roles: { include: { role: true } } },
    })
    return record ? UserMapper.toEntity(record) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findFirst({
      where: { email },
      include: { user_roles: { include: { role: true } } },
    })
    return record ? UserMapper.toEntity(record) : null
  }

  async findTenantId(userId: string): Promise<string | null> {
    const record = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tenant_id: true },
    })
    return record?.tenant_id ?? null
  }

  async getUsersList(
    pagination: Pagination,
    includeInactive = false,
    role?: string,
    search?: string,
  ): Promise<PaginatedResult<UserListProjection>> {
    const where: Prisma.UserWhereInput = includeInactive ? {} : { is_active: true }

    if (role === 'operator') {
      where.permission_template = { key: 'platform_staff' }
    } else if (role && Object.values(RoleType).includes(role as RoleType)) {
      where.user_roles = { some: { role: { name: role as RoleType } } }
    }

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: UserMapper.userListSelectConfig,
        orderBy: { created_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.user.count({ where }),
    ])

    return new PaginatedResult(
      users.map((u) => UserMapper.toListProjection(u)),
      total,
      pagination,
    )
  }

  async getUserDetail(id: string): Promise<UserDetailProjection | null> {
    const record = await this.prisma.user.findFirst({
      where: { id },
      select: UserMapper.userDetailSelectConfig,
    })

    return record ? UserMapper.toDetailProjection(record) : null
  }

  /** Returns IDs of all active users with admin role. */
  async findActiveAdminIds(): Promise<string[]> {
    const admins = await this.prisma.userRole.findMany({
      where: {
        role: { name: 'admin' },
        user: { is_active: true },
      },
      select: { user_id: true },
    })
    return admins.map((a) => a.user_id)
  }

  /** Returns a paginated, filtered, sorted list of customer/buyer users with their derived figures. */
  async getBuyersList(
    pagination: Pagination,
    filters: BuyerListFilters,
  ): Promise<PaginatedResult<BuyerListProjection>> {
    const { rows, total } = await this.getBuyersPage(filters, pagination)

    const userIds = rows.map((row) => row.id)
    const aggregates = await buildBuyerAggregates(this.prisma, userIds)
    const items = rows.map((row) =>
      toBuyerListProjection(row, aggregates.get(row.id) as BuyerAggregate),
    )

    return new PaginatedResult(items, total, pagination)
  }

  /**
   * Filters, aggregates, sorts and paginates buyers in one round trip: the candidate set and its
   * per-buyer order aggregate live in a CTE, "recurrent" is a predicate on that aggregate instead
   * of a precomputed id list, and `COUNT(*) OVER ()` carries the total alongside the page. Only the
   * page's own ids ever cross back into Node.
   */
  private async getBuyersPage(
    filters: BuyerListFilters,
    pagination: Pagination,
  ): Promise<{ rows: BuyerRow[]; total: number }> {
    const sort = resolveBuyerSort(filters.sort)
    const whereSql = buildCandidatesWhereSql(filters)
    const recurrentSql =
      filters.purchase === 'recurrent' ? Prisma.sql`WHERE a.order_count >= 2` : Prisma.empty
    const orderColumn = sortColumnSql(sort)
    const needsAggregate = sort !== 'recent' || filters.purchase === 'recurrent'

    const page = await this.prisma.$queryRaw<Array<{ id: string; total_count: bigint }>>(
      needsAggregate
        ? Prisma.sql`
      WITH candidates AS (
        SELECT u.id, u.created_at
        FROM users u
        WHERE ${whereSql}
      ),
      agg AS (
        SELECT c.id, lat.order_count, lat.spent, lat.last_purchase
        FROM candidates c
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE o.status != 'draft') AS order_count,
            COALESCE(SUM(o.subtotal) FILTER (WHERE o.status IN ('paid', 'delivered')), 0) AS spent,
            MAX(o.created_at) FILTER (WHERE o.status != 'draft') AS last_purchase
          FROM orders o
          WHERE o.user_id = c.id AND o.status <> 'draft'
        ) lat ON TRUE
      )
      SELECT c.id, COUNT(*) OVER () AS total_count
      FROM candidates c
      JOIN agg a ON a.id = c.id
      ${recurrentSql}
      ORDER BY ${orderColumn} DESC NULLS LAST, c.id ASC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `
        : Prisma.sql`
      WITH candidates AS (
        SELECT u.id, u.created_at
        FROM users u
        WHERE ${whereSql}
      )
      SELECT c.id, COUNT(*) OVER () AS total_count
      FROM candidates c
      ORDER BY ${orderColumn} DESC NULLS LAST, c.id ASC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `,
    )

    const pageIds = page.map((row) => row.id)
    const total =
      page.length > 0
        ? Number(page[0].total_count)
        : await this.countBuyersMatching(whereSql, recurrentSql)

    if (pageIds.length === 0) return { rows: [], total }

    const rows = await this.prisma.user.findMany({
      where: { id: { in: pageIds } },
      select: buyerSelectConfig,
    })
    const rowsById = new Map(rows.map((row) => [row.id, row]))

    return {
      rows: pageIds
        .map((id) => rowsById.get(id))
        .filter((row): row is BuyerRow => row !== undefined),
      total,
    }
  }

  /** Only hit when the requested page is past the last row, so `total` still comes back correctly. */
  private async countBuyersMatching(
    whereSql: Prisma.Sql,
    recurrentSql: Prisma.Sql,
  ): Promise<number> {
    const [row] = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      recurrentSql === Prisma.empty
        ? Prisma.sql`SELECT COUNT(*)::bigint AS count FROM users u WHERE ${whereSql}`
        : Prisma.sql`
      WITH candidates AS (
        SELECT u.id FROM users u WHERE ${whereSql}
      ),
      agg AS (
        SELECT c.id, COUNT(o.*) FILTER (WHERE o.status != 'draft') AS order_count
        FROM candidates c
        LEFT JOIN orders o ON o.user_id = c.id AND o.status <> 'draft'
        GROUP BY c.id
      )
      SELECT COUNT(*)::bigint AS count
      FROM agg a
      ${recurrentSql}
    `,
    )
    return Number(row?.count ?? 0)
  }

  /** Returns the five tile metrics and the four tab counts, both honouring every filter except purchase. */
  async getBuyersStats(filters: BuyerListFilters): Promise<BuyersStatsProjection> {
    const whereSql = buildCandidatesWhereSql({ ...filters, purchase: undefined })
    const thirtyDaysAgo = subtractDays(new Date(), 30)

    const [row] = await this.prisma.$queryRaw<
      Array<{
        total_buyers: bigint
        bought_count: bigint
        recurrent_count: bigint
        new_last_30_days: bigint
        total_spent: string
        total_money_order_count: bigint
      }>
    >(Prisma.sql`
      WITH candidates AS (
        SELECT u.id, u.created_at FROM users u WHERE ${whereSql}
      ),
      agg AS (
        SELECT c.id, c.created_at,
          COUNT(o.*) FILTER (WHERE o.status != 'draft') AS order_count,
          COUNT(o.*) FILTER (WHERE o.status IN ('paid', 'delivered')) AS money_order_count,
          COALESCE(SUM(o.subtotal) FILTER (WHERE o.status IN ('paid', 'delivered')), 0) AS spent
        FROM candidates c
        LEFT JOIN orders o ON o.user_id = c.id AND o.status <> 'draft'
        GROUP BY c.id, c.created_at
      )
      SELECT
        COUNT(*)::bigint AS total_buyers,
        COUNT(*) FILTER (WHERE a.order_count > 0)::bigint AS bought_count,
        COUNT(*) FILTER (WHERE a.order_count >= 2)::bigint AS recurrent_count,
        COUNT(*) FILTER (WHERE a.created_at >= ${thirtyDaysAgo})::bigint AS new_last_30_days,
        COALESCE(SUM(a.spent), 0) AS total_spent,
        COALESCE(SUM(a.money_order_count), 0)::bigint AS total_money_order_count
      FROM agg a
    `)

    const totalBuyers = Number(row?.total_buyers ?? 0n)
    const boughtCount = Number(row?.bought_count ?? 0n)
    const recurrentCount = Number(row?.recurrent_count ?? 0n)
    const newLast30Days = Number(row?.new_last_30_days ?? 0n)
    const totalSpent = new Prisma.Decimal(row?.total_spent ?? 0)
    const totalMoneyOrderCount = Number(row?.total_money_order_count ?? 0n)

    return {
      totalBuyers,
      boughtCount,
      boughtPercent: totalBuyers === 0 ? 0 : Math.round((boughtCount / totalBuyers) * 100),
      recurrentCount,
      newLast30Days,
      averageTicket: toAverageTicket(totalSpent, totalMoneyOrderCount),
      tabs: {
        all: totalBuyers,
        bought: boughtCount,
        never: totalBuyers - boughtCount,
        recurrent: recurrentCount,
      },
    }
  }

  /** Returns identity, contact, profile, derived figures, order history and consents for one customer, or null if the id does not resolve to a customer. */
  async getBuyerDetail(id: string): Promise<BuyerDetailProjection | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, user_roles: { some: { role: { name: 'customer' } } } },
      select: buyerSelectConfig,
    })
    if (!row) return null

    const [aggregates, orderRows, consentRows] = await Promise.all([
      buildBuyerAggregates(this.prisma, [id]),
      this.prisma.order.findMany({
        where: { user_id: id, status: { not: 'draft' } },
        select: buyerOrderSelectConfig,
        orderBy: { created_at: 'desc' },
      }) as Promise<BuyerOrderRow[]>,
      this.prisma.userConsent.findMany({
        where: { user_id: id },
        select: buyerConsentSelectConfig,
        orderBy: { accepted_at: 'desc' },
      }) as Promise<BuyerConsentRow[]>,
    ])

    const aggregate = aggregates.get(id) as BuyerAggregate
    const moneyOrderCount = orderRows.filter((order) =>
      MONEY_STATUSES.includes(order.status),
    ).length
    const latestConsentsByType = [
      ...consentRows
        .reduce(
          (byType, row) => (byType.has(row.type) ? byType : byType.set(row.type, row)),
          new Map<string, BuyerConsentRow>(),
        )
        .values(),
    ]

    return {
      ...toBuyerListProjection(row, aggregate),
      averageTicket: toAverageTicket(new Prisma.Decimal(aggregate.spent), moneyOrderCount),
      orders: orderRows.map(toBuyerOrderProjection),
      consents: latestConsentsByType.map((consent) => ({
        type: consent.type,
        policyVersion: consent.policy_version,
        acceptedAt: consent.accepted_at,
      })),
    }
  }

  async getMyProfile(userId: string): Promise<MyProfileProjection | null> {
    const record = await this.prisma.user.findFirst({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        avatar_url: true,
        customer_profile: {
          select: {
            country_id: true,
            province_id: true,
            canton_id: true,
            birth_date: true,
            gender: true,
          },
        },
        phones: {
          select: {
            id: true,
            phone_number: true,
            label: true,
            is_whatsapp: true,
            is_primary: true,
          },
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
        },
      },
    })

    if (!record) return null

    return {
      id: record.id,
      email: record.email,
      firstName: record.first_name,
      lastName: record.last_name,
      avatarUrl: record.avatar_url ?? UserMapper.getDiceBearUrl(record.email),
      countryId: record.customer_profile?.country_id ?? null,
      provinceId: record.customer_profile?.province_id ?? null,
      cantonId: record.customer_profile?.canton_id ?? null,
      birthDate: record.customer_profile?.birth_date ?? null,
      gender: record.customer_profile?.gender ?? null,
      phones: record.phones.map((phone) => ({
        id: phone.id,
        phoneNumber: phone.phone_number,
        label: phone.label,
        isWhatsapp: phone.is_whatsapp,
        isPrimary: phone.is_primary,
      })),
    }
  }
}
