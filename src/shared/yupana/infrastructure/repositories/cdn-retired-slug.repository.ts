import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import type { CdnRetiredSlug, ICdnRetiredSlugRepository } from '../../domain/ports'

@Injectable()
export class CdnRetiredSlugRepository implements ICdnRetiredSlugRepository {
  constructor(private readonly prisma: PrismaService) {}

  async retire(slugs: CdnRetiredSlug[], tx?: Prisma.TransactionClient): Promise<void> {
    if (slugs.length === 0) return
    const client = tx ?? this.prisma
    await client.cdnRetiredSlug.createMany({
      data: slugs.map((retired) => ({
        slug: retired.slug,
        photo_id: retired.photoId,
        event_id: retired.eventId,
      })),
      skipDuplicates: true,
    })
  }
}
