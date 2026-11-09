import { toCents } from './money-cents.vo'

describe('toCents', () => {
  it('converts whole dollars', () => {
    expect(toCents(20)).toBe(2000)
  })

  it('converts fractional dollars without float drift', () => {
    expect(toCents(12.68)).toBe(1268)
    expect(toCents(19.99)).toBe(1999)
    expect(toCents(0.1)).toBe(10)
  })

  it('rejects negative amounts', () => {
    expect(() => toCents(-1)).toThrow()
  })
})
