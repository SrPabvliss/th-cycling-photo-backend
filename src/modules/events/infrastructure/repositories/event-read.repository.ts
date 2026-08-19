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
  PublicEventDetailProjection,
  PublicEventListProjection,
  PublicPhotoProjection,
} from '../../application/projections'
import type { Event } from '../../domain/entities'
import type { AssignedEventStatus, IEventReadRepository } from '../../domain/ports'
import * as EventMapper from '../mappers/event.mapper'

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
    includeArchived: boolean,
    search: string | undefined,
    scope: EventScope,
  ): Promise<PaginatedResult<EventListProjection>> {
    const where: Prisma.EventWhereInput = {
      ...scope.toPrisma(),
      ...(includeArchived ? {} : { deleted_at: null }),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    }

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        select: EventMapper.eventListSelectConfig,
        orderBy: { start_date: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.event.count({ where }),
    ])

    return new PaginatedResult(
      events.map((e) => EventMapper.toListProjection(e, this.cdn)),
      total,
      pagination,
    )
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

  async countAll(scope: EventScope): Promise<number> {
    return this.prisma.event.count({ where: scope.toPrisma() })
  }

  async getAssignedEventsByStatus(
    operatorId: string,
    status: AssignedEventStatus,
    pagination: Pagination,
  ): Promise<PaginatedResult<EventSummaryProjection>> {
    const where: Prisma.EventWhereInput = {
      status,
      deleted_at: null,
      permission_grants: { some: { user_id: operatorId, permission: { key: 'photo.retouch.read' } } },
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
        permission_grants: { some: { user_id: operatorId, permission: { key: 'photo.retouch.read' } } },
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
