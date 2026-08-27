import type {
  EventDetailProjection,
  EventListProjection,
  EventSummaryProjection,
  PublicEventDetailProjection,
  PublicEventListProjection,
} from '@events/application/projections'
import { Event } from '@events/domain/entities'
import { type EventFacts, resolveEventAlert } from '@events/domain/event-alert'
import type { EventStatusType } from '@events/domain/value-objects/event-status.vo'
import { Prisma, type Event as PrismaEvent } from '@generated/prisma/client'
import type { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import type { EventAggregate } from '../repositories/event-aggregates'

// --- Select shapes for Prisma queries ---

export const coverImageAssetSelectConfig = {
  public_slug: true,
} satisfies Prisma.EventAssetSelect

export const eventListSelectConfig = {
  id: true,
  slug: true,
  name: true,
  start_date: true,
  end_date: true,
  province: { select: { name: true } },
  canton: { select: { name: true } },
  status: true,
  is_frozen: true,
  _count: { select: { photos: true } },
  assets: {
    select: coverImageAssetSelectConfig,
    where: { asset_type: 'cover_image' },
    take: 1,
  },
} satisfies Prisma.EventSelect

export type EventListSelect = Prisma.EventGetPayload<{ select: typeof eventListSelectConfig }>

export const eventListRowSelectConfig = {
  ...eventListSelectConfig,
  tenant_id: true,
  tenant: { select: { name: true } },
  photo_quota: true,
  photos_uploaded: true,
  deleted_at: true,
} satisfies Prisma.EventSelect

export type EventListRowSelect = Prisma.EventGetPayload<{
  select: typeof eventListRowSelectConfig
}>

export const eventDetailSelectConfig = {
  ...eventListSelectConfig,
  province_id: true,
  canton_id: true,
  photo_quota: true,
  photos_uploaded: true,
  frozen_at: true,
  created_at: true,
  updated_at: true,
  tenant: { select: { name: true } },
  event_type: { select: { name: true } },
  contract: { select: { commercial_name: true } },
} satisfies Prisma.EventSelect

export type EventDetailSelect = Prisma.EventGetPayload<{ select: typeof eventDetailSelectConfig }>

export const eventSummarySelectConfig = {
  id: true,
  slug: true,
  name: true,
  start_date: true,
  end_date: true,
  province: { select: { name: true } },
  canton: { select: { name: true } },
  _count: { select: { photos: true } },
  assets: {
    select: coverImageAssetSelectConfig,
    where: { asset_type: 'cover_image' },
    take: 1,
  },
} satisfies Prisma.EventSelect

export type EventSummarySelect = Prisma.EventGetPayload<{ select: typeof eventSummarySelectConfig }>

export const publicEventListSelectConfig = {
  slug: true,
  name: true,
  start_date: true,
  end_date: true,
  snap_public_name: true,
  province: { select: { name: true } },
  canton: { select: { name: true } },
  _count: { select: { photos: true } },
  assets: {
    select: { public_slug: true },
    where: { asset_type: 'cover_image' },
    take: 1,
  },
} satisfies Prisma.EventSelect

export type PublicEventListSelect = Prisma.EventGetPayload<{
  select: typeof publicEventListSelectConfig
}>

export const publicEventDetailSelectConfig = {
  id: true,
  name: true,
  slug: true,
  start_date: true,
  end_date: true,
  snap_public_name: true,
  province: { select: { name: true } },
  canton: { select: { name: true } },
  _count: { select: { photos: true } },
  assets: { select: { asset_type: true, public_slug: true } },
  photo_categories: {
    select: { photo_category: { select: { id: true, name: true } } },
    orderBy: { photo_category: { name: 'asc' } },
  },
} satisfies Prisma.EventSelect

export type PublicEventDetailSelect = Prisma.EventGetPayload<{
  select: typeof publicEventDetailSelectConfig
}>

// --- Entity mappers ---

/** Converts a domain entity to a Prisma create input. */
export function toPersistence(entity: Event): Prisma.EventUncheckedCreateInput {
  return {
    id: entity.id,
    tenant_id: entity.tenantId,
    name: entity.name,
    slug: entity.slug,
    start_date: entity.startDate,
    end_date: entity.endDate,
    province_id: entity.provinceId,
    canton_id: entity.cantonId,
    event_type_id: entity.eventTypeId,
    status: entity.status,
    snap_public_name: entity.snapPublicName,
    snap_watermark_storage_key: entity.snapWatermarkStorageKey,
    snap_whatsapp_number: entity.snapWhatsappNumber,
    photo_quota: entity.photoQuota,
    contract_id: entity.contractId,
    is_frozen: entity.isFrozen,
    frozen_at: entity.frozenAt,
    created_at: entity.audit.createdAt,
    updated_at: entity.audit.updatedAt,
    deleted_at: entity.audit.deletedAt,
    created_by_id: entity.audit.createdById,
    updated_by_id: entity.audit.updatedById,
  }
}

/** Converts a Prisma record to a domain entity. */
export function toEntity(record: PrismaEvent): Event {
  return Event.fromPersistence({
    id: record.id,
    tenantId: record.tenant_id,
    name: record.name,
    slug: record.slug,
    startDate: record.start_date,
    endDate: record.end_date,
    provinceId: record.province_id,
    cantonId: record.canton_id,
    eventTypeId: record.event_type_id,
    status: record.status as EventStatusType,
    snapPublicName: record.snap_public_name,
    snapWatermarkStorageKey: record.snap_watermark_storage_key,
    snapWhatsappNumber: record.snap_whatsapp_number,
    photoQuota: record.photo_quota,
    // read-only: the counter is mutated only via claimPhotoQuota's raw UPDATE, never through this write path
    photosUploaded: record.photos_uploaded,
    isFrozen: record.is_frozen,
    frozenAt: record.frozen_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    deletedAt: record.deleted_at,
    createdById: record.created_by_id,
    updatedById: record.updated_by_id,
    contractId: record.contract_id,
  })
}

// --- Projection mappers ---

/** Extracts the cover image slug from joined EventAsset rows. */
function getCoverImageSlug(assets: { public_slug: string }[]): string | null {
  return assets[0]?.public_slug ?? null
}

/** Converts a Prisma record to a summary projection (cross-module shape). */
export function toSummaryProjection(
  record: EventSummarySelect,
  cdn: CdnUrlBuilder,
): EventSummaryProjection {
  const coverSlug = getCoverImageSlug(record.assets)
  const location = [record.canton?.name, record.province?.name].filter(Boolean).join(', ')
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    startDate: record.start_date,
    endDate: record.end_date,
    location,
    coverUrl: coverSlug ? cdn.assetUrl(coverSlug, 'cover-lg') : null,
    totalPhotos: record._count.photos,
  }
}

/** Converts a Prisma selected record to a list projection. */
export function toListProjection(
  record: EventListRowSelect,
  cdn: CdnUrlBuilder,
  aggregate: EventAggregate,
): EventListProjection {
  const coverSlug = getCoverImageSlug(record.assets)
  const coverUrl = coverSlug ? cdn.assetUrl(coverSlug, 'cover-sm') : null
  const facts: EventFacts = {
    isArchived: record.deleted_at !== null,
    hasCover: coverSlug !== null,
    isFrozen: record.is_frozen,
    photoCount: record._count.photos,
    photosUploaded: record.photos_uploaded,
    photoQuota: record.photo_quota,
  }
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    startDate: record.start_date,
    endDate: record.end_date,
    provinceName: record.province?.name ?? null,
    cantonName: record.canton?.name ?? null,
    coverImageUrl: coverUrl,
    coverImageSlug: coverSlug,
    status: record.status,
    isFrozen: record.is_frozen,
    photoCount: record._count.photos,
    totalFileSize: 0,
    organizerId: record.tenant_id,
    organizerName: record.tenant.name,
    photoQuota: record.photo_quota,
    photosUploaded: record.photos_uploaded,
    reviewedCount: aggregate.reviewedCount,
    categorizedCount: aggregate.categorizedCount,
    revenue: aggregate.revenue,
    paidCount: aggregate.paidCount,
    deliveredCount: aggregate.deliveredCount,
    giftedCount: aggregate.giftedCount,
    unpaidCount: aggregate.unpaidCount,
    cancelledCount: aggregate.cancelledCount,
    soldPhotoCount: aggregate.soldPhotoCount,
    lastUploadAt: aggregate.lastUploadAt,
    isArchived: facts.isArchived,
    alert: resolveEventAlert(facts),
  }
}

/** Converts a Prisma record to a detail projection. */
export function toDetailProjection(
  record: EventDetailSelect,
  cdn: CdnUrlBuilder,
): EventDetailProjection {
  const coverSlug = getCoverImageSlug(record.assets)
  const coverUrl = coverSlug ? cdn.assetUrl(coverSlug, 'cover-lg') : null
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    startDate: record.start_date,
    endDate: record.end_date,
    provinceName: record.province?.name ?? null,
    cantonName: record.canton?.name ?? null,
    provinceId: record.province_id,
    cantonId: record.canton_id,
    coverImageUrl: coverUrl,
    coverImageSlug: coverSlug,
    status: record.status,
    photoCount: record._count.photos,
    photoQuota: record.photo_quota,
    photosUploaded: record.photos_uploaded,
    isFrozen: record.is_frozen,
    classifiedCount: 0,
    categorizedCount: 0,
    totalFileSize: 0,
    reviewedCount: 0,
    lastUploadAt: null,
    revenue: '0.00',
    ordersCount: 0,
    soldPhotoCount: 0,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    frozenAt: record.frozen_at,
    organizerName: record.tenant.name,
    eventTypeName: record.event_type.name,
    contractName: record.contract?.commercial_name ?? null,
  }
}

/** Converts a Prisma record to a public list projection. */
export function toPublicListProjection(record: PublicEventListSelect): PublicEventListProjection {
  return {
    slug: record.slug,
    name: record.name,
    startDate: record.start_date,
    endDate: record.end_date,
    provinceName: record.province?.name ?? null,
    cantonName: record.canton?.name ?? null,
    photoCount: record._count.photos,
    ownerName: record.snap_public_name ?? '',
    coverSlug: record.assets[0]?.public_slug ?? null,
  }
}

/** Converts a Prisma record to a public detail projection. */
export function toPublicDetailProjection(
  record: PublicEventDetailSelect,
  cdn: CdnUrlBuilder,
): PublicEventDetailProjection {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    startDate: record.start_date,
    endDate: record.end_date,
    provinceName: record.province?.name ?? null,
    cantonName: record.canton?.name ?? null,
    photoCount: record._count.photos,
    ownerName: record.snap_public_name ?? '',
    assets: record.assets.map((a) => ({
      assetType: a.asset_type,
      url: cdn.assetUrl(a.public_slug),
      publicSlug: a.public_slug,
    })),
    photoCategories: record.photo_categories.map((c) => ({
      id: c.photo_category.id,
      name: c.photo_category.name,
    })),
  }
}
