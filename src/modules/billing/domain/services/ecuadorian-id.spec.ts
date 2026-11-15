import { checkCedula, checkRuc } from './ecuadorian-id'

const STRICT = { enforceCompanyCheckDigit: true }
const LENIENT = { enforceCompanyCheckDigit: false }

describe('checkCedula', () => {
  it.each(['1710034065', '0926687856', '1700000001', '3000000004'])('accepts %s', (value) => {
    expect(checkCedula(value)).toEqual({ valid: true })
  })

  it.each([
    ['1700000002', 'check_digit'],
    ['1710034066', 'check_digit'],
    ['2510034065', 'province'],
    ['0010034065', 'province'],
    ['1760034065', 'third_digit'],
    ['171003406', 'malformed'],
    ['17100340a5', 'malformed'],
  ])('refuses %s (%s)', (value, reason) => {
    expect(checkCedula(value)).toEqual({ valid: false, reason })
  })
})

describe('checkRuc', () => {
  describe('of a natural person: its cédula plus an establishment', () => {
    it.each([STRICT, LENIENT])('accepts a valid one whatever the SRI can say (%o)', (options) => {
      expect(checkRuc('1710034065001', options)).toEqual({ valid: true })
    })

    it.each([STRICT, LENIENT])('always refuses a wrong check digit (%o)', (options) => {
      expect(checkRuc('1700000002001', options)).toEqual({ valid: false, reason: 'check_digit' })
    })

    it('refuses establishment 000', () => {
      expect(checkRuc('1710034065000', LENIENT)).toEqual({
        valid: false,
        reason: 'establishment',
      })
    })
  })

  describe('of a private company (third digit 9)', () => {
    it.each(['1790016919001', '1790012344001'])('accepts %s', (value) => {
      expect(checkRuc(value, STRICT)).toEqual({ valid: true })
    })

    it('refuses a wrong module-11 digit only when the SRI cannot be asked', () => {
      expect(checkRuc('1790012345001', STRICT)).toEqual({ valid: false, reason: 'check_digit' })
      expect(checkRuc('1790012345001', LENIENT)).toEqual({ valid: true })
    })

    it('always refuses establishment 000', () => {
      expect(checkRuc('1790016919000', LENIENT)).toEqual({
        valid: false,
        reason: 'establishment',
      })
    })
  })

  describe('of a public entity (third digit 6)', () => {
    it('accepts a valid one', () => {
      expect(checkRuc('1760001550001', STRICT)).toEqual({ valid: true })
    })

    it('refuses a wrong module-11 digit only when the SRI cannot be asked', () => {
      expect(checkRuc('1760001560001', STRICT)).toEqual({ valid: false, reason: 'check_digit' })
      expect(checkRuc('1760001560001', LENIENT)).toEqual({ valid: true })
    })

    it('always refuses establishment 0000', () => {
      expect(checkRuc('1760001550000', LENIENT)).toEqual({
        valid: false,
        reason: 'establishment',
      })
    })
  })

  it.each([
    ['1770016919001', 'third_digit'],
    ['1780016919001', 'third_digit'],
    ['9990016919001', 'province'],
    ['179001691900', 'malformed'],
  ])('refuses %s (%s)', (value, reason) => {
    expect(checkRuc(value, LENIENT)).toEqual({ valid: false, reason })
  })
})
