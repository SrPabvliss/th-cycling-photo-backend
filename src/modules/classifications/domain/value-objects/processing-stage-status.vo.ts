import { ProcessingStageStatus } from '@generated/prisma/client'
import { AppException } from '@shared/domain'

export class ProcessingStageStatusVo {
  private constructor(public readonly value: ProcessingStageStatus) {}

  static fromValue(v: string): ProcessingStageStatusVo {
    if (!Object.values(ProcessingStageStatus).includes(v as ProcessingStageStatus)) {
      throw AppException.businessRule('processing_stage_status.invalid', false, { received: v })
    }
    return new ProcessingStageStatusVo(v as ProcessingStageStatus)
  }
}
