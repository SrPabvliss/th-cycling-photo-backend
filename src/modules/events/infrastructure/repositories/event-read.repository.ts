import { NEAR_QUOTA_PERCENT } from '@events/domain/event-alert'
import { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PaginatedResult, type Pagination } from '@shared/application'
import type { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { PrismaService } from '@shared/infrastructure'
import type {
  EventBriefProjection,
  EventDetailProjection,
  EventListProjection,
  EventSummaryProjection,
  EventsStatsProjection,
  PublicEventDetailProjection,
  PublicEventListProjection,
  PublicPhotoProjection,
} from '../../application/projections'
import type { EventListFilters } from '../../application/queries/get-events-list/get-events-list.dto'
import type { Event } from '../../domain/entities'
import type { AssignedEventStatus, IEventReadRepository } from '../../domain/ports'
import * as EventMapper from '../mappers/event.mapper'
import { buildEventAggregates, type EventAggregate } from './event-aggregates'
import {
  eventListWhereSql,
  eventSortLateralSql,
  eventSortSql,
  eventTabConditionSql,
  resolveEventSort,
  resolveEventTab,
} from './event-list-sql'

type EventsStatsRow = {
  total_events: number
  active_events: number
  visible_events: number
  near_or_over_quota: number
  tab_all: number
  tab_active: number
  tab_no_cover: number
  tab_frozen: number
  tab_archived: number
  events_pending_review: number
  photos_online: number
  pending_review: number
  revenue: Prisma.Decimal | string | null
  orders: number
  unpaid_orders: number
}

@Injectable()
export class EventReadRepository implements IEventReadRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  async findById(id: string, includeArchived = false): Promise<Event | null> {
    const where = includeArchived ? { id } : { id, deleted_at: null }
    const record = await this.prisma.event.findFirst({ where })
    return record ? EventMapper.toEntity(record) : null
  }

  async findByIdInScope(
    id: string,
    scope: EventScope,
    includeArchived = false,
  ): Promise<Event | null> {
    // Folding scope into the where clause makes an out-of-scope id 404 rather than 403, so the
    // caller can't learn an event exists by probing UUIDs.
    const where = includeArchived
      ? { id, ...scope.toPrisma() }
      : { id, deleted_at: null, ...scope.toPrisma() }
    const record = await this.prisma.event.findFirst({ where })
    return record ? EventMapper.toEntity(record) : null
  }

  async getEventsList(
    pagination: Pagination,
    filters: EventListFilters,
    scope: EventScope,
  ): Promise<PaginatedResult<EventListProjection>> {
    const { rows, total } = await this.getEventsPage(filters, pagination, scope)

    const aggregates = await buildEventAggregates(
      this.prisma,
      rows.map((row) => row.id),
    )

    const items = rows.map((row) =>
      EventMapper.toListProjection(row, this.cdn, aggregates.get(row.id) as EventAggregate),
    )

    return new PaginatedResult(items, total, pagination)
  }

  /**
   * Filters, sorts and paginates in the database, then hydrates only the page's own ids. Every sort
   * resolves in SQL — a page reordered in Node would shuffle rows as the reader scrolls — and the
   * aggregates the last three sorts need hang off a lateral over the already-filtered candidate set,
   * so neither `photos` nor `orders` is ever scanned whole. `COUNT(*) OVER ()` carries the total
   * beside the page.
   */
  private async getEventsPage(
    filters: EventListFilters,
    pagination: Pagination,
    scope: EventScope,
  ): Promise<{ rows: EventMapper.EventListRowSelect[]; total: number }> {
    const tab = resolveEventTab(filters.tab)
    const sort = resolveEventSort(filters.sort)
    const whereSql = eventListWhereSql(filters, scope, tab)

    const page = await this.prisma.$queryRaw<Array<{ id: string; total_count: bigint }>>(Prisma.sql`
      WITH candidates AS (
        SELECT e.id, e.name, e.start_date, e.created_at, e.photos_uploaded, e.photo_quota
        FROM events e
        WHERE ${whereSql}
      )
      SELECT c.id, COUNT(*) OVER () AS total_count
      FROM candidates c
      ${eventSortLateralSql(sort)}
      ORDER BY ${eventSortSql(sort)}, c.id ASC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `)

    const pageIds = page.map((row) => row.id)
    const total =
      page.length > 0 ? Number(page[0].total_count) : await this.countEventsMatching(whereSql)

    if (pageIds.length === 0) return { rows: [], total }

    const rows = await this.prisma.event.findMany({
      where: { id: { in: pageIds } },
      select: EventMapper.eventListRowSelectConfig,
    })
    const rowsById = new Map(rows.map((row) => [row.id, row]))

    return {
      rows: pageIds
        .map((id) => rowsById.get(id))
        .filter((row): row is EventMapper.EventListRowSelect => row !== undefined),
      total,
    }
  }

  /** Only reached when the requested page is past the last row, so `total` still comes back right. */
  private async countEventsMatching(whereSql: Prisma.Sql): Promise<number> {
    const [row] = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM events e WHERE ${whereSql}`,
    )
    return Number(row?.count ?? 0)
  }

  async getEventDetailBySlug(
    slug: string,
    scope: EventScope,
  ): Promise<EventDetailProjection | null> {
    // Folding scope into the where clause makes an out-of-scope slug 404 rather than 403, so the
    // caller can't learn an event exists by probing slugs.
    const record = await this.prisma.event.findFirst({
      where: { slug, ...scope.toPrisma() },
      select: EventMapper.eventDetailSelectConfig,
    })

    if (!record) return null

    return EventMapper.toDetailProjection(record, this.cdn)
  }

  async getAggregateByEvent(eventId: string): Promise<EventAggregate> {
    const map = await buildEventAggregates(this.prisma, [eventId])
    const aggregate = map.get(eventId)
    if (!aggregate) throw new Error(`No aggregate built for event ${eventId}`)
    return aggregate
  }

  async countAll(scope: EventScope): Promise<number> {
    return this.prisma.event.count({ where: scope.toPrisma() })
  }

  /**
   * `tab` is deliberately never read out of `filters` — `eventListWhereSql` is called with the
   * literal `'all'` tab, whose predicate is `TRUE`, so the tiles and every tab's own count share
   * the exact same scoped population and only `search`/`organizerId` can move them. Everything is
   * aggregated in three grouped queries scoped to that population first, never over the whole
   * `photos` or `orders` table.
   */
  async getEventsStats(
    filters: EventListFilters,
    scope: EventScope,
  ): Promise<EventsStatsProjection> {
    const whereSql = eventListWhereSql(filters, scope, 'all')

    const [row] = await this.prisma.$queryRaw<EventsStatsRow[]>(Prisma.sql`
      WITH scoped AS (
        SELECT e.id, e.deleted_at, e.is_frozen, e.photo_quota, e.photos_uploaded
        FROM events e
        WHERE ${whereSql}
      ),
      event_stats AS (
        SELECT
          COUNT(*)::int AS total_events,
          COUNT(*) FILTER (WHERE e.deleted_at IS NULL)::int AS active_events,
          COUNT(*) FILTER (
            WHERE e.deleted_at IS NULL AND EXISTS (
              SELECT 1 FROM event_assets a WHERE a.event_id = e.id AND a.asset_type = 'cover_image'
            )
          )::int AS visible_events,
          COUNT(*) FILTER (
            WHERE e.deleted_at IS NULL
              AND e.photo_quota IS NOT NULL
              AND (
                e.photos_uploaded >= e.photo_quota
                OR e.photos_uploaded::float / NULLIF(e.photo_quota, 0) * 100 >= ${NEAR_QUOTA_PERCENT}
              )
          )::int AS near_or_over_quota,
          COUNT(*) FILTER (WHERE ${eventTabConditionSql('all')})::int AS tab_all,
          COUNT(*) FILTER (WHERE ${eventTabConditionSql('active')})::int AS tab_active,
          COUNT(*) FILTER (WHERE ${eventTabConditionSql('no_cover')})::int AS tab_no_cover,
          COUNT(*) FILTER (WHERE ${eventTabConditionSql('frozen')})::int AS tab_frozen,
          COUNT(*) FILTER (WHERE ${eventTabConditionSql('archived')})::int AS tab_archived,
          COUNT(*) FILTER (
            WHERE EXISTS (SELECT 1 FROM photos p WHERE p.event_id = e.id AND p.reviewed_at IS NULL)
          )::int AS events_pending_review
        FROM scoped e
      ),
      photo_stats AS (
        SELECT
          COUNT(*)::int AS photos_online,
          COUNT(*) FILTER (WHERE p.reviewed_at IS NULL)::int AS pending_review
        FROM photos p
        WHERE p.event_id IN (SELECT id FROM scoped)
      ),
      order_stats AS (
        SELECT
          COALESCE(SUM(o.subtotal) FILTER (WHERE o.status IN ('paid', 'delivered')), 0) AS revenue,
          COUNT(*) FILTER (WHERE o.status <> 'draft')::int AS orders,
          COUNT(*) FILTER (WHERE o.status IN ('pending', 'payment_info_sent'))::int AS unpaid_orders
        FROM orders o
        WHERE o.event_id IN (SELECT id FROM scoped)
      )
      SELECT * FROM event_stats, photo_stats, order_stats
    `)

    return {
      totalEvents: row?.total_events ?? 0,
      activeEvents: row?.active_events ?? 0,
      visibleEvents: row?.visible_events ?? 0,
      photosOnline: row?.photos_online ?? 0,
      pendingReview: row?.pending_review ?? 0,
      eventsPendingReview: row?.events_pending_review ?? 0,
      nearOrOverQuota: row?.near_or_over_quota ?? 0,
      revenue: new Prisma.Decimal(row?.revenue ?? 0).toFixed(2),
      orders: row?.orders ?? 0,
      unpaidOrders: row?.unpaid_orders ?? 0,
      tabs: {
        all: row?.tab_all ?? 0,
        active: row?.tab_active ?? 0,
        no_cover: row?.tab_no_cover ?? 0,
        frozen: row?.tab_frozen ?? 0,
        archived: row?.tab_archived ?? 0,
      },
    }
  }

  async getAssignedEventsByStatus(
    operatorId: string,
    status: AssignedEventStatus,
    pagination: Pagination,
  ): Promise<PaginatedResult<EventSummaryProjection>> {
    const where: Prisma.EventWhereInput = {
      status,
      deleted_at: null,
      permission_grants: {
        some: { user_id: operatorId, permission: { key: 'photo.retouch.read' } },
      },
    }

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        select: EventMapper.eventSummarySelectConfig,
        orderBy: { start_date: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.event.count({ where }),
    ])

    const items = events.map((e) => EventMapper.toSummaryProjection(e, this.cdn))
    return new PaginatedResult(items, total, pagination)
  }

  async countAssignedEventsByStatus(
    operatorId: string,
    status: AssignedEventStatus,
  ): Promise<number> {
    return this.prisma.event.count({
      where: {
        status,
        deleted_at: null,
        permission_grants: {
          some: { user_id: operatorId, permission: { key: 'photo.retouch.read' } },
        },
      },
    })
  }

  async getAssignedEventIdsByStatus(
    operatorId: string,
    status: AssignedEventStatus,
  ): Promise<string[]> {
    const rows = await this.prisma.event.findMany({
      where: {
        status,
        deleted_at: null,
        permission_grants: {
          some: { user_id: operatorId, permission: { key: 'photo.retouch.read' } },
        },
      },
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }

  async getAllAssignedEventIds(operatorId: string): Promise<string[]> {
    const rows = await this.prisma.event.findMany({
      where: {
        deleted_at: null,
        permission_grants: {
          some: { user_id: operatorId, permission: { key: 'photo.retouch.read' } },
        },
      },
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }

  async getEventBriefsByIds(ids: string[]): Promise<EventBriefProjection[]> {
    if (ids.length === 0) return []
    const rows = await this.prisma.event.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true, name: true },
    })
    return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name }))
  }

  async getPublicEventsList(
    pagination: Pagination,
  ): Promise<PaginatedResult<PublicEventListProjection>> {
    // Public listings require a cover_image asset — no cover means the event is
    // still in "setup incomplete" state and must not be visible to buyers.
    const where: Prisma.EventWhereInput = {
      deleted_at: null,
      status: 'active',
      assets: { some: { asset_type: 'cover_image' } },
    }

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        select: EventMapper.publicEventListSelectConfig,
        orderBy: { start_date: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.event.count({ where }),
    ])

    const items = events.map((e) => EventMapper.toPublicListProjection(e))

    return new PaginatedResult(items, total, pagination)
  }

  async getPublicEventDetail(slug: string): Promise<PublicEventDetailProjection | null> {
    const event = await this.prisma.event.findFirst({
      where: {
        slug,
        deleted_at: null,
        status: 'active',
        assets: { some: { asset_type: 'cover_image' } },
      },
      select: EventMapper.publicEventDetailSelectConfig,
    })

    if (!event) return null

    return EventMapper.toPublicDetailProjection(event, this.cdn)
  }

  async getPublicPhotos(
    eventId: string,
    pagination: Pagination,
    options: {
      photoCategoryId: number | null
      bibNumber: string | null
      bibMatch: 'exact' | 'starts' | 'contains'
      section: 'matched' | 'no_bib' | null
    },
  ): Promise<PaginatedResult<PublicPhotoProjection>> {
    // The "no_bib" section is independent from the bib filter — it returns
    // photos in the event with no non-deleted bib so the rider can find
    // themselves when OCR missed the plate. Same category filter still
    // applies. Caller is expected to set `section: 'no_bib'`; we don't
    // require `bibNumber` here because the set itself doesn't depend on
    // the searched digits, only on the absence of any detected bib.
    if (options.section === 'no_bib') {
      return this.getPhotosWithoutBib(eventId, pagination, options.photoCategoryId)
    }

    const where: Prisma.PhotoWhereInput = { event_id: eventId }

    if (options.photoCategoryId) {
      where.photo_category_id = options.photoCategoryId
    }

    if (options.bibNumber) {
      const ids = await this.findMatchingBibPhotoIds(eventId, options.bibNumber, options.bibMatch)
      if (ids.length === 0) {
        return new PaginatedResult<PublicPhotoProjection>([], 0, pagination)
      }
      where.id = { in: ids }
    }

    const [photos, total] = await Promise.all([
      this.prisma.photo.findMany({
        where,
        select: { id: true, public_slug: true, width: true, height: true },
        orderBy: { uploaded_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.photo.count({ where }),
    ])

    return new PaginatedResult(
      photos.map((p) => ({
        id: p.id,
        publicSlug: p.public_slug,
        width: p.width,
        height: p.height,
      })),
      total,
      pagination,
    )
  }

  /**
   * Returns paginated photos in the given event that have no detected
   * bib at all (or whose bibs were all soft-deleted). Used to feed the
   * "no plate detected" companion section of the public gallery search,
   * so a rider whose plate wasn't visible to OCR can still browse their
   * own photos.
   */
  private async getPhotosWithoutBib(
    eventId: string,
    pagination: Pagination,
    photoCategoryId: number | null,
  ): Promise<PaginatedResult<PublicPhotoProjection>> {
    const where: Prisma.PhotoWhereInput = {
      event_id: eventId,
      bibs: { none: { deleted_at: null } },
    }

    if (photoCategoryId) {
      where.photo_category_id = photoCategoryId
    }

    const [photos, total] = await Promise.all([
      this.prisma.photo.findMany({
        where,
        select: { id: true, public_slug: true, width: true, height: true },
        orderBy: { uploaded_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.photo.count({ where }),
    ])

    return new PaginatedResult(
      photos.map((p) => ({
        id: p.id,
        publicSlug: p.public_slug,
        width: p.width,
        height: p.height,
      })),
      total,
      pagination,
    )
  }

  async existsActiveEvent(eventId: string): Promise<{ id: string; name: string } | null> {
    // An event is considered "active" (publicly usable) only if it has a cover_image.
    // This blocks order creation and gallery browsing for events without a cover.
    return this.prisma.event.findFirst({
      where: {
        id: eventId,
        status: 'active',
        deleted_at: null,
        assets: { some: { asset_type: 'cover_image' } },
      },
      select: { id: true, name: true },
    })
  }

  async existsActiveEventBySlug(slug: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.event.findFirst({
      where: {
        slug,
        status: 'active',
        deleted_at: null,
        assets: { some: { asset_type: 'cover_image' } },
      },
      select: { id: true, name: true },
    })
  }

  async isFrozen(eventId: string): Promise<boolean> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { is_frozen: true },
    })
    return event?.is_frozen ?? false
  }

  /**
   * Returns photo ids for the given event whose effective (latest-correction)
   * bib digits match. Skips soft-deleted bibs. A correction with `new_value = NULL`
   * is honored — the row will NOT match (we use CASE, not COALESCE).
   */
  private async findMatchingBibPhotoIds(
    eventId: string,
    value: string,
    match: 'exact' | 'starts' | 'contains',
  ): Promise<string[]> {
    const escaped = value.replace(/[\\%_]/g, (c) => `\\${c}`)
    const pattern =
      match === 'starts' ? `${escaped}%` : match === 'contains' ? `%${escaped}%` : escaped

    const sql =
      match === 'exact'
        ? Prisma.sql`
            SELECT DISTINCT pb.photo_id
            FROM photo_bibs pb
            JOIN photos p ON p.id = pb.photo_id AND p.event_id = ${eventId}::uuid
            LEFT JOIN LATERAL (
              SELECT new_value AS corrected_value, TRUE AS has_correction
              FROM corrections
              WHERE target_type = 'photo_bib' AND target_id = pb.id AND field = 'digits'
              ORDER BY corrected_at DESC LIMIT 1
            ) latest ON TRUE
            WHERE pb.deleted_at IS NULL
              AND LOWER(
                CASE WHEN latest.has_correction THEN latest.corrected_value ELSE pb.digits END
              ) = LOWER(${value})
          `
        : Prisma.sql`
            SELECT DISTINCT pb.photo_id
            FROM photo_bibs pb
            JOIN photos p ON p.id = pb.photo_id AND p.event_id = ${eventId}::uuid
            LEFT JOIN LATERAL (
              SELECT new_value AS corrected_value, TRUE AS has_correction
              FROM corrections
              WHERE target_type = 'photo_bib' AND target_id = pb.id AND field = 'digits'
              ORDER BY corrected_at DESC LIMIT 1
            ) latest ON TRUE
            WHERE pb.deleted_at IS NULL
              AND (
                CASE WHEN latest.has_correction THEN latest.corrected_value ELSE pb.digits END
              ) ILIKE ${pattern} ESCAPE '\\'
          `

    const rows = await this.prisma.$queryRaw<Array<{ photo_id: string }>>(sql)
    return rows.map((r) => r.photo_id)
  }
}
