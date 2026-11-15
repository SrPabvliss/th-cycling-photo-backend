/**
 * Local checks of an Ecuadorian cédula or RUC, so a number with a wrong check digit is refused
 * even when rikuchiy (the SRI validation) does not answer.
 *
 * - A cédula, and the RUC of a natural person (third digit 0–5), are its cédula plus an
 *   establishment: the module-10 check digit is exact and always enforced.
 * - The RUC of a private company (third digit 9) or a public entity (6) carries a module-11 check
 *   digit. Its structure is always enforced; the digit is enforced only when the SRI cannot be
 *   asked (`enforceCompanyCheckDigit`), because no official source confirms that every company
 *   RUC issued today satisfies it, and a real buyer must never be refused while the SRI says yes.
 */
export type EcuadorianIdVerdict = { valid: true } | { valid: false; reason: EcuadorianIdRejection }

export type EcuadorianIdRejection =
  | 'malformed'
  | 'province'
  | 'third_digit'
  | 'check_digit'
  | 'establishment'

/** 01–24 are the provinces; 30 is for Ecuadorians registered abroad. */
const PROVINCE = (code: number) => (code >= 1 && code <= 24) || code === 30

const ok: EcuadorianIdVerdict = { valid: true }
const fail = (reason: EcuadorianIdRejection): EcuadorianIdVerdict => ({ valid: false, reason })

function digitsOf(value: string): number[] {
  return [...value].map(Number)
}

function module10(digits: number[]): number {
  const sum = digits.slice(0, 9).reduce((total, digit, index) => {
    const product = digit * (index % 2 === 0 ? 2 : 1)
    return total + (product > 9 ? product - 9 : product)
  }, 0)
  return (10 - (sum % 10)) % 10
}

function module11(digits: number[], coefficients: number[]): number {
  const sum = coefficients.reduce(
    (total, coefficient, index) => total + digits[index] * coefficient,
    0,
  )
  const remainder = sum % 11
  return remainder === 0 ? 0 : 11 - remainder
}

export function checkCedula(value: string): EcuadorianIdVerdict {
  if (!/^\d{10}$/.test(value)) return fail('malformed')
  const digits = digitsOf(value)
  if (!PROVINCE(digits[0] * 10 + digits[1])) return fail('province')
  if (digits[2] > 5) return fail('third_digit')
  if (module10(digits) !== digits[9]) return fail('check_digit')
  return ok
}

export function checkRuc(
  value: string,
  { enforceCompanyCheckDigit }: { enforceCompanyCheckDigit: boolean },
): EcuadorianIdVerdict {
  if (!/^\d{13}$/.test(value)) return fail('malformed')
  const digits = digitsOf(value)
  if (!PROVINCE(digits[0] * 10 + digits[1])) return fail('province')

  const third = digits[2]

  if (third <= 5) {
    const cedula = checkCedula(value.slice(0, 10))
    if (!cedula.valid) return cedula
    return value.slice(10) === '000' ? fail('establishment') : ok
  }

  if (third === 6) {
    if (value.slice(9) === '0000') return fail('establishment')
    if (enforceCompanyCheckDigit && module11(digits, [3, 2, 7, 6, 5, 4, 3, 2]) !== digits[8]) {
      return fail('check_digit')
    }
    return ok
  }

  if (third === 9) {
    if (value.slice(10) === '000') return fail('establishment')
    if (enforceCompanyCheckDigit && module11(digits, [4, 3, 2, 7, 6, 5, 4, 3, 2]) !== digits[9]) {
      return fail('check_digit')
    }
    return ok
  }

  return fail('third_digit')
}
