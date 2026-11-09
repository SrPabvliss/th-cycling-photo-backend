import {
  EventFacts,
  isQuotaExhausted,
  isQuotaNear,
  isVisible,
  quotaRemaining,
  resolveEventAlert,
} from './event-alert'

const base: EventFacts = {
  isArchived: false,
  hasCover: true,
  isFrozen: false,
  photoCount: 100,
  photosUploaded: 100,
  photoQuota: 1000,
}

describe('isVisible', () => {
  it('does not exclude a frozen event — freezing never hides it from the gallery', () => {
    expect(isVisible({ ...base, isFrozen: true })).toBe(true)
  })

  it('excludes an active event with no cover', () => {
    expect(isVisible({ ...base, hasCover: false })).toBe(false)
  })

  it('excludes an archived event even with a cover', () => {
    expect(isVisible({ ...base, isArchived: true })).toBe(false)
  })
})

describe('quota', () => {
  it('measures consumption against photosUploaded, not the live photo count', () => {
    const e = { ...base, photoCount: 10, photosUploaded: 1000, photoQuota: 1000 }
    expect(isQuotaExhausted(e)).toBe(true)
    expect(quotaRemaining(e)).toBe(0)
  })

  it('treats a null quota as no limit', () => {
    const e = { ...base, photoQuota: null, photosUploaded: 99999 }
    expect(isQuotaExhausted(e)).toBe(false)
    expect(isQuotaNear(e)).toBe(false)
    expect(quotaRemaining(e)).toBeNull()
  })

  it('is near at exactly the threshold and not near once exhausted', () => {
    expect(isQuotaNear({ ...base, photosUploaded: 850, photoQuota: 1000 })).toBe(true)
    expect(isQuotaNear({ ...base, photosUploaded: 1000, photoQuota: 1000 })).toBe(false)
  })
})

describe('resolveEventAlert', () => {
  it('states archived above everything else', () => {
    expect(resolveEventAlert({ ...base, isArchived: true, hasCover: false, isFrozen: true })).toBe(
      'archived',
    )
  })

  it('states no_cover above quota_exhausted and frozen', () => {
    const e = { ...base, hasCover: false, isFrozen: true, photosUploaded: 1000, photoQuota: 1000 }
    expect(resolveEventAlert(e)).toBe('no_cover')
  })

  it('states quota_exhausted above frozen', () => {
    expect(
      resolveEventAlert({ ...base, isFrozen: true, photosUploaded: 1000, photoQuota: 1000 }),
    ).toBe('quota_exhausted')
  })

  it('states empty for an event with no photos', () => {
    expect(resolveEventAlert({ ...base, photoCount: 0, photosUploaded: 0 })).toBe('empty')
  })

  it('is null for a healthy event', () => {
    expect(resolveEventAlert(base)).toBeNull()
  })
})
