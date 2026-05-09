import { type Correction, CorrectionTargetType, Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import {
  type IAppendCorrectionInput,
  type ICorrectionRepository,
  type ILatestCorrection,
} from '@photos/domain/ports'
import { PrismaService } from '@shared/infrastructure'

@Injectable()
export class CorrectionRepository implements ICorrectionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async appendCorrection(input: IAppendCorrectionInput): Promise<Correction> {
    return this.prisma.correction.create({
      data: {
        photo_id: input.photoId,
        target_type: input.targetType,
        target_id: input.targetId,
        field: input.field,
        old_value: input.oldValue,
        new_value: input.newValue,
        reviewer_id: input.reviewerId,
      },
    })
  }

  async findLatestForTarget(
    targetType: CorrectionTargetType,
    targetId: string,
    field: string,
  ): Promise<ILatestCorrection | null> {
    const row = await this.prisma.correction.findFirst({
      where: { target_type: targetType, target_id: targetId, field },
      orderBy: { corrected_at: 'desc' },
    })
    if (!row) return null
    return {
      id: row.id,
      newValue: row.new_value,
      oldValue: row.old_value,
      correctedAt: row.corrected_at,
      reviewerId: row.reviewer_id,
    }
  }

  async findLatestByTargets(
    targets: Array<{ targetType: CorrectionTargetType; targetId: string }>,
  ): Promise<Map<string, ILatestCorrection>> {
    if (targets.length === 0) return new Map()

    type Row = {
      id: string
      target_type: CorrectionTargetType
      target_id: string
      field: string
      new_value: string | null
      old_value: string | null
      corrected_at: Date
      reviewer_id: string
    }

    const tuples = Prisma.join(
      targets.map(
        (t) => Prisma.sql`(${t.targetType}::"CorrectionTargetType", ${t.targetId}::uuid)`,
      ),
    )

    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT DISTINCT ON (target_type, target_id, field)
        id, target_type, target_id, field, new_value, old_value, corrected_at, reviewer_id
      FROM corrections
      WHERE (target_type, target_id) IN (${tuples})
      ORDER BY target_type, target_id, field, corrected_at DESC
    `

    const map = new Map<string, ILatestCorrection>()
    for (const r of rows) {
      const key = `${r.target_type}:${r.target_id}:${r.field}`
      map.set(key, {
        id: r.id,
        newValue: r.new_value,
        oldValue: r.old_value,
        correctedAt: r.corrected_at,
        reviewerId: r.reviewer_id,
      })
    }
    return map
  }
}
