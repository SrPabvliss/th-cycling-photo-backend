import { BibReadingStatus } from '@generated/prisma/client'
import { AppException } from '@shared/domain'
import { BibReadingStatusVo } from './bib-reading-status.vo'

describe('BibReadingStatusVo', () => {
  it('builds read / abstained factories', () => {
    expect(BibReadingStatusVo.read().value).toBe(BibReadingStatus.read)
    expect(BibReadingStatusVo.abstained().value).toBe(BibReadingStatus.abstained)
  })

  it('parses valid string', () => {
    expect(BibReadingStatusVo.fromValue('read').value).toBe(BibReadingStatus.read)
  })

  it('throws AppException for invalid value', () => {
    expect(() => BibReadingStatusVo.fromValue('rejected')).toThrow(AppException)
  })

  it('isRead returns true only for read', () => {
    expect(BibReadingStatusVo.read().isRead()).toBe(true)
    expect(BibReadingStatusVo.abstained().isRead()).toBe(false)
  })
})
