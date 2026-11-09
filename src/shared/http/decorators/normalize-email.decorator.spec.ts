import { LoginDto } from '@auth/application/commands/login/login.dto'
import { plainToInstance } from 'class-transformer'
import { normalizeEmail } from './normalize-email.decorator'

describe('NormalizeEmail', () => {
  it('trims and lowercases a string', () => {
    expect(normalizeEmail('  QA.CUS2@Titantv.Test ')).toBe('qa.cus2@titantv.test')
  })

  it('leaves non-strings alone so the validator reports them', () => {
    expect(normalizeEmail(undefined)).toBeUndefined()
    expect(normalizeEmail(42)).toBe(42)
  })

  it('applies to the login email', () => {
    const dto = plainToInstance(LoginDto, { email: 'Ana@Example.COM', password: 'x' })
    expect(dto.email).toBe('ana@example.com')
  })
})
