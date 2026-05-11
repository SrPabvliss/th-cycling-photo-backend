import type { Correction, CorrectionTargetType } from '@generated/prisma/client'

export interface ILatestCorrection {
  id: string
  newValue: string | null
  oldValue: string | null
  correctedAt: Date
  reviewerId: string
}

export interface IAppendCorrectionInput {
  photoId: string
  targetType: CorrectionTargetType
  targetId: string
  field: string
  oldValue: string | null
  newValue: string | null
  reviewerId: string
}

export interface ICorrectionRepository {
  appendCorrection(input: IAppendCorrectionInput): Promise<Correction>
  findLatestByTargets(
    targets: Array<{ targetType: CorrectionTargetType; targetId: string }>,
  ): Promise<Map<string, ILatestCorrection>>
  findLatestForTarget(
    targetType: CorrectionTargetType,
    targetId: string,
    field: string,
  ): Promise<ILatestCorrection | null>
}

export const CORRECTION_REPOSITORY = Symbol('CORRECTION_REPOSITORY')
