import { BibReadingStatus } from '@generated/prisma/client'
import { AppException } from '@shared/domain'

export class BibReadingStatusVo {
  private constructor(public readonly value: BibReadingStatus) {}

  static matched(): BibReadingStatusVo {
    return new BibReadingStatusVo(BibReadingStatus.matched)
  }
  static abstained(): BibReadingStatusVo {
    return new BibReadingStatusVo(BibReadingStatus.abstained)
  }
  static unmatched(): BibReadingStatusVo {
    return new BibReadingStatusVo(BibReadingStatus.unmatched)
  }

  static fromValue(v: string): BibReadingStatusVo {
    if (!Object.values(BibReadingStatus).includes(v as BibReadingStatus)) {
      throw AppException.businessRule('bib_reading_status.invalid', false, { received: v })
    }
    return new BibReadingStatusVo(v as BibReadingStatus)
  }

  isMatched(): boolean {
    return this.value === BibReadingStatus.matched
  }
}
