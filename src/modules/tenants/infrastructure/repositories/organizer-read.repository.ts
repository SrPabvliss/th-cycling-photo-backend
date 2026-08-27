import { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PaginatedResult, type Pagination } from '@shared/application'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { EVENT_SLOT_CONSUMED_FILTER, toEcuadorDateOnly } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import type {
  OrganizerContractProjection,
  OrganizerDetailProjection,
  OrganizerPayoutProjection,
} from '../../application/projections/organizer-detail.projection'
import type { OrganizerEventProjection } from '../../application/projections/organizer-event.projection'
import type {
  InvitationCardProjection,
  OrganizerCardProjection,
  OrganizerRowProjection,
} from '../../application/projections/organizer-list.projection'
import type { OrganizersStatsProjection } from '../../application/projections/organizers-stats.projection'
import {
  EXPIRING_SOON_DAYS,
  resolveInvitationState,
  resolveOrganizerState,
} from '../../domain/organizer-state'
import type {
  IOrganizerReadRepository,
  OrganizerListFilters,
  OrganizerSort,
  OrganizerTab,
} from '../../domain/ports/organizer-read-repository.port'
import {
  CONTRACT_USAGE_SQL,
  invitationSearchSql,
  ORGANIZER_AGG_SQL,
  organizerSearchSql,
} from './organizer-sql'

const MS_PER_DAY = 86_400_000

interface UnionRow {
  kind: 'organizer' | 'invitation'
  id: string
  sort_group: number
  name: string | null
  holder_name: string | null
  holder_email: string | null
  holder_email_verified: boolean | null
  available: number | null
  total_capacity: number | null
  used_capacity: number | null
  next_expiry: Date | null
  last_expiry: Date | null
  lost_slots: number | null
  photos_per_event_in_use: number | null
  photo_limits_differ: boolean | null
  event_count: number | null
  created_at: Date
  status: string | null
  valid_until: Date | null
  events_total: number | null
  photos_per_event: number | null
  issued_by_name: string | null
  renewal_of_organizer_id: string | null
  renewal_of_organizer_name: string | null
  total_count: bigint
}

interface DetailRow {
  id: string
  name: string
  public_name: string | null
  watermark_storage_key: string | null
  whatsapp_number: string | null
  whatsapp_verified_at: Date | null
  created_at: Date
  default_event_photo_quota: number | null
  holder_name: string | null
  holder_email: string | null
  holder_email_verified: boolean | null
  event_count: number | null
  last_event_at: Date | null
  available: number | null
  total_capacity: number | null
  used_capacity: number | null
  next_expiry: Date | null
  last_expiry: Date | null
  lost_slots: number | null
  valid_contract_count: number | null
  photo_limits_differ: boolean | null
  photos_per_event_in_use: number | null
}

interface ContractRow {
  id: string
  events_total: number
  photos_per_event: number | null
  valid_until: Date
  accepted_at: Date | null
  status: string
  terms_version: string
  created_at: Date
  is_backfill: boolean
  used: number | null
  is_valid: boolean
  issued_by_name: string | null
}

const EVENT_SLOT_CONSUMED_SQL = Prisma.sql`(e.deleted_at IS NULL OR e.photos_uploaded > 0)`

const HOLDER_NAME_SQL = Prisma.sql`COALESCE(NULLIF(TRIM(COALESCE(hu.first_name, '') || ' ' || COALESCE(hu.last_name, '')), ''), hu.email)`

const ISSUER_NAME_SQL = Prisma.sql`NULLIF(TRIM(COALESCE(iu.first_name, '') || ' ' || COALESCE(iu.last_name, '')), '')`

function resolveTab(tab: OrganizerTab | undefined): OrganizerTab {
  return tab === 'active' ||
    tab === 'no_quota' ||
    tab === 'expiring' ||
    tab === 'invitations' ||
    tab === 'all'
    ? tab
    : 'all'
}

function resolveSort(sort: OrganizerSort | undefined): OrganizerSort {
  return sort === 'available' || sort === 'expiry' || sort === 'events' ? sort : 'recent'
}

function tabConditionSql(tab: OrganizerTab, expiringCutoff: Date): Prisma.Sql {
  switch (tab) {
    case 'active':
      return Prisma.sql`x.kind = 'organizer' AND x.available > 0`
    case 'no_quota':
      return Prisma.sql`x.kind = 'organizer' AND x.available = 0`
    case 'expiring':
      return Prisma.sql`x.kind = 'organizer' AND x.available > 0 AND x.next_expiry IS NOT NULL AND x.next_expiry <= ${expiringCutoff}`
    case 'invitations':
      return Prisma.sql`x.kind = 'invitation'`
    default:
      return Prisma.sql`TRUE`
  }
}

function tabSql(tab: OrganizerTab, expiringCutoff: Date): Prisma.Sql {
  if (tab === 'all') return Prisma.empty
  return Prisma.sql`WHERE ${tabConditionSql(tab, expiringCutoff)}`
}

function pendingConditionSql(now: Date): Prisma.Sql {
  return Prisma.sql`x.kind = 'invitation' AND x.valid_until >= ${now}`
}

function sortSql(sort: OrganizerSort): Prisma.Sql {
  if (sort === 'available') return Prisma.sql`x.available DESC NULLS LAST`
  if (sort === 'expiry') return Prisma.sql`x.next_expiry ASC NULLS LAST`
  if (sort === 'events') return Prisma.sql`x.event_count DESC NULLS LAST`
  return Prisma.sql`x.created_at DESC`
}

function unionSql(filters: OrganizerListFilters, now: Date): Prisma.Sql {
  return Prisma.sql`
    WITH org_candidates AS (
      SELECT
        t.id,
        t.name,
        t.created_at,
        h.holder_name,
        h.holder_email,
        h.holder_email_verified,
        COALESCE(ev.event_count, 0) AS event_count,
        ev.last_event_at
      FROM tenants t
      LEFT JOIN LATERAL (
        SELECT
          ${HOLDER_NAME_SQL} AS holder_name,
          hu.email AS holder_email,
          (hu.email_verified_at IS NOT NULL) AS holder_email_verified
        FROM users hu
        WHERE hu.tenant_id = t.id
        ORDER BY hu.created_at ASC, hu.id ASC
        LIMIT 1
      ) h ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS event_count, MAX(e.created_at) AS last_event_at
        FROM events e
        WHERE e.tenant_id = t.id AND ${EVENT_SLOT_CONSUMED_SQL}
      ) ev ON TRUE
      WHERE t.is_platform = false
      ${organizerSearchSql(filters.search)}
    ),
    contracts AS (
      SELECT
        k.id,
        k.tenant_id,
        k.events_total,
        k.photos_per_event,
        k.valid_until,
        k.accepted_at,
        k.status::text AS status,
        usage.used,
        (k.status = 'accepted' AND k.valid_until >= ${now}) AS is_valid
      FROM tenant_contracts k
      JOIN org_candidates oc ON oc.id = k.tenant_id
      ${CONTRACT_USAGE_SQL}
    ),
    agg AS (
      ${ORGANIZER_AGG_SQL}
    ),
    in_use AS (
      SELECT DISTINCT ON (k.tenant_id) k.tenant_id, k.photos_per_event
      FROM contracts k
      WHERE k.is_valid AND (k.events_total - k.used) > 0
      ORDER BY k.tenant_id, k.accepted_at ASC, k.id ASC
    ),
    invitations AS (
      SELECT
        k.id,
        k.commercial_name,
        k.events_total,
        k.photos_per_event,
        k.valid_until,
        k.created_at,
        k.status::text AS status,
        ${HOLDER_NAME_SQL} AS holder_name,
        hu.email AS holder_email,
        (hu.email_verified_at IS NOT NULL) AS holder_email_verified,
        ${ISSUER_NAME_SQL} AS issued_by_name,
        ht.id AS renewal_of_organizer_id,
        ht.name AS renewal_of_organizer_name
      FROM tenant_contracts k
      JOIN users hu ON hu.id = k.user_id
      LEFT JOIN users iu ON iu.id = k.issued_by_id
      LEFT JOIN tenants ht ON ht.id = hu.tenant_id AND ht.is_platform = false
      WHERE k.tenant_id IS NULL
        AND k.status <> 'accepted'
        AND k.status <> 'revoked'
      ${invitationSearchSql(filters.search)}
    )
    SELECT
      'organizer'::text AS kind,
      oc.id AS id,
      1 AS sort_group,
      NULL::timestamptz AS sort_ts,
      oc.name AS name,
      oc.holder_name AS holder_name,
      oc.holder_email AS holder_email,
      COALESCE(oc.holder_email_verified, false) AS holder_email_verified,
      COALESCE(a.available, 0) AS available,
      COALESCE(a.total_capacity, 0) AS total_capacity,
      COALESCE(a.used_capacity, 0) AS used_capacity,
      a.next_expiry AS next_expiry,
      a.last_expiry AS last_expiry,
      COALESCE(a.lost_slots, 0) AS lost_slots,
      iu.photos_per_event AS photos_per_event_in_use,
      COALESCE(a.photo_limits_differ, false) AS photo_limits_differ,
      oc.event_count AS event_count,
      oc.created_at AS created_at,
      NULL::text AS status,
      NULL::timestamptz AS valid_until,
      NULL::int AS events_total,
      NULL::int AS photos_per_event,
      NULL::text AS issued_by_name,
      NULL::uuid AS renewal_of_organizer_id,
      NULL::text AS renewal_of_organizer_name
    FROM org_candidates oc
    LEFT JOIN agg a ON a.tenant_id = oc.id
    LEFT JOIN in_use iu ON iu.tenant_id = oc.id
    UNION ALL
    SELECT
      'invitation'::text AS kind,
      i.id AS id,
      CASE WHEN i.valid_until < ${now} THEN 2 ELSE 0 END AS sort_group,
      CASE WHEN i.valid_until < ${now} THEN i.valid_until ELSE i.created_at END AS sort_ts,
      i.commercial_name AS name,
      i.holder_name AS holder_name,
      i.holder_email AS holder_email,
      i.holder_email_verified AS holder_email_verified,
      NULL::int AS available,
      NULL::int AS total_capacity,
      NULL::int AS used_capacity,
      NULL::timestamptz AS next_expiry,
      NULL::timestamptz AS last_expiry,
      NULL::int AS lost_slots,
      NULL::int AS photos_per_event_in_use,
      NULL::boolean AS photo_limits_differ,
      NULL::int AS event_count,
      i.created_at AS created_at,
      i.status AS status,
      i.valid_until AS valid_until,
      i.events_total AS events_total,
      i.photos_per_event AS photos_per_event,
      i.issued_by_name AS issued_by_name,
      i.renewal_of_organizer_id AS renewal_of_organizer_id,
      i.renewal_of_organizer_name AS renewal_of_organizer_name
    FROM invitations i
  `
}

function toOrganizerCard(row: UnionRow, now: Date): OrganizerCardProjection {
  const available = row.available ?? 0
  const nextExpiry = row.next_expiry
  return {
    kind: 'organizer',
    id: row.id,
    name: row.name ?? '',
    holderName: row.holder_name ?? '',
    holderEmail: row.holder_email ?? '',
    holderEmailVerified: row.holder_email_verified ?? false,
    state: resolveOrganizerState({ available, nextExpiry }, now),
    available,
    totalCapacity: row.total_capacity ?? 0,
    usedCapacity: row.used_capacity ?? 0,
    nextExpiry: nextExpiry === null ? null : toEcuadorDateOnly(nextExpiry),
    lastExpiry: row.last_expiry === null ? null : toEcuadorDateOnly(row.last_expiry),
    lostSlots: row.lost_slots ?? 0,
    photosPerEventInUse: row.photos_per_event_in_use,
    photoLimitsDiffer: row.photo_limits_differ ?? false,
    createdAt: row.created_at,
  }
}

function toInvitationCard(row: UnionRow, now: Date): InvitationCardProjection {
  const validUntil = row.valid_until as Date
  return {
    kind: 'invitation',
    id: row.id,
    commercialName: row.name ?? '',
    holderName: row.holder_name ?? '',
    holderEmail: row.holder_email ?? '',
    holderEmailVerified: row.holder_email_verified ?? false,
    state: resolveInvitationState({ status: row.status ?? '', validUntil }, now),
    eventsTotal: row.events_total ?? 0,
    photosPerEvent: row.photos_per_event,
    validUntil: toEcuadorDateOnly(validUntil),
    issuedAt: row.created_at,
    issuedByName: row.issued_by_name,
    renewalOfOrganizerId: row.renewal_of_organizer_id,
    renewalOfOrganizerName: row.renewal_of_organizer_name,
  }
}

function toOrganizerContract(row: ContractRow): OrganizerContractProjection {
  const eventsUsed = row.used ?? 0
  const isValid = row.is_valid
  const lostSlots =
    row.status === 'accepted' && !isValid ? Math.max(row.events_total - eventsUsed, 0) : 0
  return {
    id: row.id,
    eventsTotal: row.events_total,
    eventsUsed,
    photosPerEvent: row.photos_per_event,
    isValid,
    isRevoked: row.status === 'revoked',
    lostSlots,
    validUntil: toEcuadorDateOnly(row.valid_until),
    acceptedAt: row.accepted_at,
    termsVersion: row.terms_version,
    issuedByName: row.issued_by_name,
    issuedAt: row.created_at,
    isBackfill: row.is_backfill,
  }
}

function toOrganizerPayout(row: {
  id: string
  provider: string
  is_active: boolean
  bank_name: string | null
  account_number: string | null
  account_type: string | null
  account_holder: string | null
  holder_identification: string | null
  receiver_identifier: string | null
  verified_at: Date | null
}): OrganizerPayoutProjection {
  return {
    id: row.id,
    provider: row.provider,
    isActive: row.is_active,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    accountType: row.account_type,
    accountHolder: row.account_holder,
    holderIdentification: row.holder_identification,
    receiverIdentifier: row.receiver_identifier,
    verifiedAt: row.verified_at,
  }
}

function toOrganizerDetail(
  row: DetailRow,
  contractRows: ContractRow[],
  payoutRows: Array<{
    id: string
    provider: string
    is_active: boolean
    bank_name: string | null
    account_number: string | null
    account_type: string | null
    account_holder: string | null
    holder_identification: string | null
    receiver_identifier: string | null
    verified_at: Date | null
  }>,
  accountCount: number,
  now: Date,
  cdn: CdnUrlBuilder,
): OrganizerDetailProjection {
  const available = row.available ?? 0
  const nextExpiry = row.next_expiry
  return {
    id: row.id,
    name: row.name,
    publicName: row.public_name,
    watermarkUrl: row.watermark_storage_key
      ? cdn.watermarkUrl(row.id, row.watermark_storage_key)
      : null,
    whatsappNumber: row.whatsapp_number,
    whatsappVerified: row.whatsapp_verified_at !== null,
    holderName: row.holder_name ?? '',
    holderEmail: row.holder_email ?? '',
    holderEmailVerified: row.holder_email_verified ?? false,
    accountCount,
    createdAt: row.created_at,
    state: resolveOrganizerState({ available, nextExpiry }, now),
    available,
    totalCapacity: row.total_capacity ?? 0,
    usedCapacity: row.used_capacity ?? 0,
    validContractCount: row.valid_contract_count ?? 0,
    nextExpiry: nextExpiry === null ? null : toEcuadorDateOnly(nextExpiry),
    lostSlots: row.lost_slots ?? 0,
    photosPerEventInUse: row.photos_per_event_in_use,
    photoLimitsDiffer: row.photo_limits_differ ?? false,
    eventCount: row.event_count ?? 0,
    lastEventAt: row.last_event_at,
    defaultEventPhotoQuota: row.default_event_photo_quota,
    contracts: contractRows.map(toOrganizerContract),
    payouts: payoutRows.map(toOrganizerPayout),
  }
}

@Injectable()
export class OrganizerReadRepository implements IOrganizerReadRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  async getOrganizersPage(
    filters: OrganizerListFilters,
    pagination: Pagination,
  ): Promise<PaginatedResult<OrganizerRowProjection>> {
    const now = new Date()
    const expiringCutoff = new Date(now.getTime() + EXPIRING_SOON_DAYS * MS_PER_DAY)
    const tab = resolveTab(filters.tab)
    const sort = resolveSort(filters.sort)
    const union = unionSql(filters, now)
    const where = tabSql(tab, expiringCutoff)

    const rows = await this.prisma.$queryRaw<UnionRow[]>(Prisma.sql`
      SELECT x.*, COUNT(*) OVER () AS total_count
      FROM (${union}) x
      ${where}
      ORDER BY x.sort_group ASC, x.sort_ts DESC NULLS LAST, ${sortSql(sort)}, x.id ASC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `)

    const total =
      rows.length > 0 ? Number(rows[0].total_count) : await this.countMatching(union, where)

    const items = rows.map((row) =>
      row.kind === 'organizer' ? toOrganizerCard(row, now) : toInvitationCard(row, now),
    )

    return new PaginatedResult<OrganizerRowProjection>(items, total, pagination)
  }

  private async countMatching(union: Prisma.Sql, where: Prisma.Sql): Promise<number> {
    const [row] = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM (${union}) x
      ${where}
    `)
    return Number(row?.count ?? 0)
  }

  async getOrganizersStats(filters: OrganizerListFilters): Promise<OrganizersStatsProjection> {
    const now = new Date()
    const expiringCutoff = new Date(now.getTime() + EXPIRING_SOON_DAYS * MS_PER_DAY)
    const union = unionSql(filters, now)

    const activeCond = tabConditionSql('active', expiringCutoff)
    const noQuotaCond = tabConditionSql('no_quota', expiringCutoff)
    const expiringCond = tabConditionSql('expiring', expiringCutoff)
    const invitationsCond = tabConditionSql('invitations', expiringCutoff)
    const pendingCond = pendingConditionSql(now)

    const [row] = await this.prisma.$queryRaw<
      Array<{
        active: bigint
        no_quota: bigint
        expiring: bigint
        pending: bigint
        tab_all: bigint
        tab_active: bigint
        tab_no_quota: bigint
        tab_expiring: bigint
        tab_invitations: bigint
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE ${activeCond}) AS active,
        COUNT(*) FILTER (WHERE ${noQuotaCond}) AS no_quota,
        COUNT(*) FILTER (WHERE ${expiringCond}) AS expiring,
        COUNT(*) FILTER (WHERE ${pendingCond}) AS pending,
        COUNT(*) AS tab_all,
        COUNT(*) FILTER (WHERE ${activeCond}) AS tab_active,
        COUNT(*) FILTER (WHERE ${noQuotaCond}) AS tab_no_quota,
        COUNT(*) FILTER (WHERE ${expiringCond}) AS tab_expiring,
        COUNT(*) FILTER (WHERE ${invitationsCond}) AS tab_invitations
      FROM (${union}) x
    `)

    return {
      active: Number(row?.active ?? 0),
      noQuota: Number(row?.no_quota ?? 0),
      expiring: Number(row?.expiring ?? 0),
      pending: Number(row?.pending ?? 0),
      tabs: {
        all: Number(row?.tab_all ?? 0),
        active: Number(row?.tab_active ?? 0),
        noQuota: Number(row?.tab_no_quota ?? 0),
        expiring: Number(row?.tab_expiring ?? 0),
        invitations: Number(row?.tab_invitations ?? 0),
      },
    }
  }

  async getOrganizerDetail(id: string): Promise<OrganizerDetailProjection | null> {
    const now = new Date()

    const [detailRow] = await this.prisma.$queryRaw<DetailRow[]>(Prisma.sql`
      WITH target AS (
        SELECT
          t.id, t.name, t.public_name, t.watermark_storage_key, t.whatsapp_number,
          t.whatsapp_verified_at, t.created_at, t.default_event_photo_quota
        FROM tenants t
        WHERE t.id = ${id} AND t.is_platform = false
      ),
      holder AS (
        SELECT
          ${HOLDER_NAME_SQL} AS holder_name,
          hu.email AS holder_email,
          (hu.email_verified_at IS NOT NULL) AS holder_email_verified
        FROM users hu
        WHERE hu.tenant_id = ${id}
        ORDER BY hu.created_at ASC, hu.id ASC
        LIMIT 1
      ),
      events_agg AS (
        SELECT COUNT(*)::int AS event_count, MAX(e.created_at) AS last_event_at
        FROM events e
        WHERE e.tenant_id = ${id} AND ${EVENT_SLOT_CONSUMED_SQL}
      ),
      contracts AS (
        SELECT
          k.id, k.tenant_id, k.events_total, k.photos_per_event, k.valid_until, k.accepted_at,
          k.status::text AS status, usage.used,
          (k.status = 'accepted' AND k.valid_until >= ${now}) AS is_valid
        FROM tenant_contracts k
        ${CONTRACT_USAGE_SQL}
        WHERE k.tenant_id = ${id}
      ),
      agg AS (
        ${ORGANIZER_AGG_SQL}
      ),
      in_use AS (
        SELECT DISTINCT ON (k.tenant_id) k.tenant_id, k.photos_per_event
        FROM contracts k
        WHERE k.is_valid AND (k.events_total - k.used) > 0
        ORDER BY k.tenant_id, k.accepted_at ASC, k.id ASC
      )
      SELECT
        t.id, t.name, t.public_name, t.watermark_storage_key, t.whatsapp_number,
        t.whatsapp_verified_at, t.created_at, t.default_event_photo_quota,
        h.holder_name, h.holder_email, h.holder_email_verified,
        COALESCE(ev.event_count, 0) AS event_count, ev.last_event_at,
        COALESCE(a.available, 0) AS available,
        COALESCE(a.total_capacity, 0) AS total_capacity,
        COALESCE(a.used_capacity, 0) AS used_capacity,
        a.next_expiry, a.last_expiry,
        COALESCE(a.lost_slots, 0) AS lost_slots,
        COALESCE(a.valid_contract_count, 0) AS valid_contract_count,
        COALESCE(a.photo_limits_differ, false) AS photo_limits_differ,
        iu.photos_per_event AS photos_per_event_in_use
      FROM target t
      LEFT JOIN holder h ON TRUE
      LEFT JOIN events_agg ev ON TRUE
      LEFT JOIN agg a ON a.tenant_id = t.id
      LEFT JOIN in_use iu ON iu.tenant_id = t.id
    `)

    if (!detailRow) return null

    const [contractRows, payoutRows, accountCount] = await Promise.all([
      this.prisma.$queryRaw<ContractRow[]>(Prisma.sql`
        SELECT
          k.id, k.events_total, k.photos_per_event, k.valid_until, k.accepted_at,
          k.status::text AS status, k.terms_version, k.created_at, k.is_backfill, usage.used,
          (k.status = 'accepted' AND k.valid_until >= ${now}) AS is_valid,
          ${ISSUER_NAME_SQL} AS issued_by_name
        FROM tenant_contracts k
        LEFT JOIN users iu ON iu.id = k.issued_by_id
        ${CONTRACT_USAGE_SQL}
        WHERE k.tenant_id = ${id}
        ORDER BY k.accepted_at ASC NULLS LAST, k.id ASC
      `),
      this.prisma.tenantPayoutMethod.findMany({
        where: { tenant_id: id },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      }),
      this.prisma.user.count({ where: { tenant_id: id } }),
    ])

    return toOrganizerDetail(detailRow, contractRows, payoutRows, accountCount, now, this.cdn)
  }

  async getOrganizerEvents(
    id: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<OrganizerEventProjection>> {
    const where = { tenant_id: id, ...EVENT_SLOT_CONSUMED_FILTER }

    const [rows, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: [{ start_date: 'desc' }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.take,
        select: {
          id: true,
          name: true,
          start_date: true,
          end_date: true,
          photos_uploaded: true,
          photo_quota: true,
        },
      }),
      this.prisma.event.count({ where }),
    ])

    const items = rows.map(
      (row): OrganizerEventProjection => ({
        id: row.id,
        name: row.name,
        startDate: toEcuadorDateOnly(row.start_date),
        endDate: toEcuadorDateOnly(row.end_date),
        photosUploaded: row.photos_uploaded,
        photoQuota: row.photo_quota,
      }),
    )

    return new PaginatedResult<OrganizerEventProjection>(items, total, pagination)
  }
}
