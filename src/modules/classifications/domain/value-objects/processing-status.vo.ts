import { ProcessingStatus } from '@generated/prisma/client'
import { AppException } from '@shared/domain'

export class ProcessingStatusVo {
  private constructor(public readonly value: ProcessingStatus) {}

  static running(): ProcessingStatusVo {
    return new ProcessingStatusVo(ProcessingStatus.running)
  }
  static completed(): ProcessingStatusVo {
    return new ProcessingStatusVo(ProcessingStatus.completed)
  }
  static failed(): ProcessingStatusVo {
    return new ProcessingStatusVo(ProcessingStatus.failed)
  }

  static fromValue(v: string): ProcessingStatusVo {
    if (!Object.values(ProcessingStatus).includes(v as ProcessingStatus)) {
      throw AppException.businessRule('processing_status.invalid', false, { received: v })
    }
    return new ProcessingStatusVo(v as ProcessingStatus)
  }
}
