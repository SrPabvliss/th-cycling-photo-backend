import type { Prisma } from '@generated/prisma/client'

/**
 * The one rule that decides whether an event is public: listed, opened, browsed, bought from and
 * linked back to from the buyer's orders. A completed event keeps its gallery: the race is over
 * but its photos are still on sale. A cover image is required: without one the event is still
 * being set up and must not be visible to buyers.
 *
 * It comes in two forms that must never drift apart — `PUBLICLY_LISTED_EVENT` for queries and
 * `isPubliclyListedEvent` for an event already loaded with `PUBLIC_EVENT_RULE_SELECT` — and
 * `public-event-rule.integration.spec.ts` checks them against each other.
 */
export const PUBLIC_EVENT_STATUSES = ['active', 'completed'] as const

export const PUBLICLY_LISTED_EVENT = {
  deleted_at: null,
  status: { in: [...PUBLIC_EVENT_STATUSES] },
  assets: { some: { asset_type: 'cover_image' } },
} satisfies Prisma.EventWhereInput

/** The event fields `isPubliclyListedEvent` reads. The cover is counted, not loaded. */
export const PUBLIC_EVENT_RULE_SELECT = {
  status: true,
  deleted_at: true,
  _count: { select: { assets: { where: { asset_type: 'cover_image' } } } },
} satisfies Prisma.EventSelect

export type PublicEventRuleFields = Prisma.EventGetPayload<{
  select: typeof PUBLIC_EVENT_RULE_SELECT
}>

export function isPubliclyListedEvent(event: PublicEventRuleFields): boolean {
  return (
    event.deleted_at === null &&
    (PUBLIC_EVENT_STATUSES as readonly string[]).includes(event.status) &&
    event._count.assets > 0
  )
}
