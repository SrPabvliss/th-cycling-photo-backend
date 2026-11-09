import type { Prisma } from '@generated/prisma/client'

export interface CdnRetiredSlug {
  slug: string
  photoId: string
  eventId: string
}

export interface ICdnRetiredSlugRepository {
  retire(slugs: CdnRetiredSlug[], tx?: Prisma.TransactionClient): Promise<void>
}

export const CDN_RETIRED_SLUG_REPOSITORY = Symbol('CDN_RETIRED_SLUG_REPOSITORY')
