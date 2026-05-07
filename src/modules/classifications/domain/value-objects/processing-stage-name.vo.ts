import { ProcessingStageName } from '@generated/prisma/client'
import { AppException } from '@shared/domain'

export class ProcessingStageNameVo {
  private constructor(public readonly value: ProcessingStageName) {}

  static fromValue(v: string): ProcessingStageNameVo {
    if (!Object.values(ProcessingStageName).includes(v as ProcessingStageName)) {
      throw AppException.businessRule('processing_stage_name.invalid', false, { received: v })
    }
    return new ProcessingStageNameVo(v as ProcessingStageName)
  }
}
