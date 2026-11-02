import type { Prisma } from '@generated/prisma/client'
import type { CdnSubjectRef } from '../cdn-transformation-day'
import type { CdnTransformationPoint } from './cdn-transformation-source.port'

export interface ICdnTransformationRepository {
  findLastProcessedDay(): Promise<string | null>
  recordSightings(
    day: string,
    points: CdnTransformationPoint[],
    tx: Prisma.TransactionClient,
  ): Promise<CdnTransformationPoint[]>
  resolveSubjects(
    points: CdnTransformationPoint[],
    tx: Prisma.TransactionClient,
  ): Promise<Map<string, CdnSubjectRef>>
  markProcessed(day: string, newCombinations: number, tx: Prisma.TransactionClient): Promise<void>
}

export const CDN_TRANSFORMATION_REPOSITORY = Symbol('CDN_TRANSFORMATION_REPOSITORY')
