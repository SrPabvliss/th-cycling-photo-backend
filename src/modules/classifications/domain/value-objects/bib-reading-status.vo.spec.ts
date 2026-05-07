import { BibReadingStatus } from '@generated/prisma/client'
import { AppException } from '@shared/domain'
import { BibReadingStatusVo } from './bib-reading-status.vo'

describe('BibReadingStatusVo', () => {
  it('builds matched / abstained / unmatched factories', () => {
    expect(BibReadingStatusVo.matched().value).toBe(BibReadingStatus.matched)
    expect(BibReadingStatusVo.abstained().value).toBe(BibReadingStatus.abstained)
    expect(BibReadingStatusVo.unmatched().value).toBe(BibReadingStatus.unmatched)
  })

  it('parses valid string', () => {
    expect(BibReadingStatusVo.fromValue('matched').value).toBe(BibReadingStatus.matched)
  })

  it('throws AppException for invalid value', () => {
    expect(() => BibReadingStatusVo.fromValue('rejected')).toThrow(AppException)
  })

  it('isMatched returns true only for matched', () => {
    expect(BibReadingStatusVo.matched().isMatched()).toBe(true)
    expect(BibReadingStatusVo.abstained().isMatched()).toBe(false)
  })
})
