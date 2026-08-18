import {
  EC_COUNTRY_CODE,
  normalizeEcuadorPhone,
  toCheckFormat,
  toSplitFormat,
} from './payphone-phone.vo'

describe('normalizeEcuadorPhone', () => {
  it('accepts the local format with a leading zero', () => {
    expect(normalizeEcuadorPhone('0984112233')).toBe('984112233')
  })

  it('accepts the international format with a plus sign', () => {
    expect(normalizeEcuadorPhone('+593984112233')).toBe('984112233')
  })

  it('accepts the international format without a plus sign', () => {
    expect(normalizeEcuadorPhone('593984112233')).toBe('984112233')
  })

  it('ignores spaces and dashes', () => {
    expect(normalizeEcuadorPhone('098 411-2233')).toBe('984112233')
  })

  it('rejects a number that is too short', () => {
    expect(() => normalizeEcuadorPhone('09841122')).toThrow()
  })

  it('rejects a landline that does not start with 9', () => {
    expect(() => normalizeEcuadorPhone('032845123')).toThrow()
  })

  it('rejects letters', () => {
    expect(() => normalizeEcuadorPhone('09841ABCD')).toThrow()
  })
})

describe('output formats', () => {
  it('builds the check endpoint format', () => {
    expect(toCheckFormat('984112233')).toBe('0984112233')
  })

  it('builds the split identifier format', () => {
    expect(toSplitFormat('984112233')).toBe('+593984112233')
  })

  it('exposes the numeric country code the check endpoint expects', () => {
    expect(EC_COUNTRY_CODE).toBe('593')
  })
})
