import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { CdnSubject } from '../../domain/cdn-subject'
import { type CdnSubjectRef, CdnTransformationDay } from '../../domain/cdn-transformation-day'
import type { CdnTransformationPoint, ICdnTransformationRepository } from '../../domain/ports'

function dateOf(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

@Injectable()
export class CdnTransformationRepository implements ICdnTransformationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLastProcessedDay(): Promise<string | null> {
    const last = await this.prisma.cdnTransformationReportDay.findFirst({
      orderBy: { day: 'desc' },
      select: { day: true },
    })
    return last ? last.day.toISOString().slice(0, 10) : null
  }

  async recordSightings(
    day: string,
    points: CdnTransformationPoint[],
    tx: Prisma.TransactionClient,
  ): Promise<CdnTransformationPoint[]> {
    if (points.length === 0) return []
    const month = CdnTransformationDay.monthOf(day)
    const inserted = await tx.cdnTransformationSighting.createManyAndReturn({
      data: points.map((point) => ({
        month,
        combination_key: point.combinationKey,
        kind: point.kind,
        slug: point.slug,
        first_seen_on: dateOf(day),
      })),
      skipDuplicates: true,
      select: { combination_key: true, kind: true, slug: true },
    })
    return inserted.map((row) => ({
      combinationKey: row.combination_key,
      kind: row.kind,
      slug: row.slug,
    }))
  }

  async resolveSubjects(
    points: CdnTransformationPoint[],
    tx: Prisma.TransactionClient,
  ): Promise<Map<string, CdnSubjectRef>> {
    const subjects = new Map<string, CdnSubjectRef>()
    const assetSlugs = [...new Set(points.filter((p) => p.kind === 'asset').map((p) => p.slug))]
    const photoSlugs = [...new Set(points.filter((p) => p.kind !== 'asset').map((p) => p.slug))]

    if (photoSlugs.length > 0) {
      const photos = await tx.photo.findMany({
        where: {
          OR: [{ public_slug: { in: photoSlugs } }, { retouched_public_slug: { in: photoSlugs } }],
        },
        select: { id: true, event_id: true, public_slug: true, retouched_public_slug: true },
      })
      for (const photo of photos) {
        const subject = { photoId: photo.id, eventId: photo.event_id }
        subjects.set(CdnTransformationDay.subjectKey('photo', photo.public_slug), subject)
        if (photo.retouched_public_slug) {
          subjects.set(
            CdnTransformationDay.subjectKey('photo', photo.retouched_public_slug),
            subject,
          )
        }
      }
    }

    if (assetSlugs.length > 0) {
      const assets = await tx.eventAsset.findMany({
        where: { public_slug: { in: assetSlugs } },
        select: { id: true, event_id: true, public_slug: true },
      })
      for (const asset of assets) {
        subjects.set(CdnTransformationDay.subjectKey('asset', asset.public_slug), {
          photoId: CdnSubject.forAsset(asset.id),
          eventId: asset.event_id,
        })
      }
    }

    const missing = points.filter(
      (point) => !subjects.has(CdnTransformationDay.subjectKey(point.kind, point.slug)),
    )
    if (missing.length > 0) {
      const retired = await tx.cdnRetiredSlug.findMany({
        where: { slug: { in: [...new Set(missing.map((point) => point.slug))] } },
      })
      const retiredBySlug = new Map(retired.map((row) => [row.slug, row]))
      for (const point of missing) {
        const row = retiredBySlug.get(point.slug)
        if (row) {
          subjects.set(CdnTransformationDay.subjectKey(point.kind, point.slug), {
            photoId: row.photo_id,
            eventId: row.event_id,
          })
        }
      }
    }

    return subjects
  }

  async markProcessed(
    day: string,
    newCombinations: number,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.cdnTransformationReportDay.create({
      data: { day: dateOf(day), new_combinations: newCombinations },
    })
  }
}
