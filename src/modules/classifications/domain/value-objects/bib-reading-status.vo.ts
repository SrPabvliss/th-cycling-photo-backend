import { BibReadingStatus } from '@generated/prisma/client'
import { AppException } from '@shared/domain'

export class BibReadingStatusVo {
  private constructor(public readonly value: BibReadingStatus) {}

  static read(): BibReadingStatusVo {
    return new BibReadingStatusVo(BibReadingStatus.read)
  }
  static abstained(): BibReadingStatusVo {
    return new BibReadingStatusVo(BibReadingStatus.abstained)
  }

  static fromValue(v: string): BibReadingStatusVo {
    if (!Object.values(BibReadingStatus).includes(v as BibReadingStatus)) {
      throw AppException.businessRule('bib_reading_status.invalid', false, { received: v })
    }
    return new BibReadingStatusVo(v as BibReadingStatus)
  }

  isRead(): boolean {
    return this.value === BibReadingStatus.read
  }
}
