import { validate } from 'class-validator'
import { IsAccountPassword, isAccountPassword } from './is-account-password.validator'

describe('isAccountPassword', () => {
  it.each([
    ['letters and digits', 'abcdefg1'],
    ['a single letter among digits', '1234567a'],
    ['an uppercase letter and a digit', 'A1234567'],
    ['an accented letter plus a digit', 'ááááááá1'],
    ['ñ as the only letter plus digits', 'ñ1234567'],
    ['a non-Latin letter plus a digit', 'пароль12'],
    ['spaces inside, with a letter and a digit', 'mi clave 1'],
    ['leading and trailing spaces, counted as characters', ' abc123 '],
    ['symbols with a letter and a digit', 'Pass-1!?'],
    ['an emoji with a letter and a digit', '🚴🚴🚴abc1'],
    ['exactly 8 characters', 'abcdefg1'],
    ['exactly 128 characters', `${'a'.repeat(127)}1`],
  ])('accepts %s', (_case, password) => {
    expect(isAccountPassword(password)).toBe(true)
  })

  it.each([
    ['only letters', 'abcdefgh'],
    ['only digits', '12345678'],
    ['only accented letters', 'áéíóúñüá'],
    ['only spaces', '        '],
    ['digits and spaces, no letter', '1234 5678'],
    ['letters and spaces, no digit', 'abcd efgh'],
    ['symbols and digits, no letter', '1234567!'],
    ['an emoji and digits, no letter', '🚴🚴🚴1234'],
    ['7 characters', 'abcdef1'],
    ['129 characters', `${'a'.repeat(128)}1`],
    ['an empty string', ''],
  ])('rejects %s', (_case, password) => {
    expect(isAccountPassword(password)).toBe(false)
  })

  it.each([
    ['a number', 12345678],
    ['null', null],
    ['undefined', undefined],
    ['an array', ['abcdefg1']],
  ])('rejects %s, which is not a string', (_case, value) => {
    expect(isAccountPassword(value)).toBe(false)
  })
})

describe('@IsAccountPassword', () => {
  class Sample {
    @IsAccountPassword()
    password: unknown
  }

  function sample(password: unknown): Sample {
    const instance = new Sample()
    instance.password = password
    return instance
  }

  it('passes a valid password', async () => {
    expect(await validate(sample('abcdefg1'))).toHaveLength(0)
  })

  it('reports the field and a message that states the rule', async () => {
    const errors = await validate(sample('abcdefgh'))

    expect(errors).toHaveLength(1)
    expect(errors[0].property).toBe('password')
    expect(errors[0].constraints).toEqual({
      isAccountPassword:
        'password must be 8 to 128 characters long and contain at least one letter and one number',
    })
  })
})
