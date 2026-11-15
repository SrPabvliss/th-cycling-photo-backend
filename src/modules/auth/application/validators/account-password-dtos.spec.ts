import { BadRequestException, type Type, ValidationPipe } from '@nestjs/common'
import { ChangePasswordDto } from '../commands/change-password/change-password.dto'
import { ConfirmPasswordResetDto } from '../commands/confirm-password-reset/confirm-password-reset.dto'
import { LoginDto } from '../commands/login/login.dto'
import { RegisterDto } from '../commands/register/register.dto'

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
})

function parse<T>(metatype: Type<T>, body: Record<string, unknown>): Promise<T> {
  return pipe.transform(body, { type: 'body', metatype })
}

async function messagesOf(attempt: Promise<unknown>): Promise<string[]> {
  try {
    await attempt
  } catch (error) {
    if (error instanceof BadRequestException) {
      return (error.getResponse() as { message: string[] }).message
    }
    throw error
  }
  return []
}

const RULE = 'must be 8 to 128 characters long and contain at least one letter and one number'

const REGISTER_BASE = {
  email: 'buyer@example.com',
  firstName: 'Ana',
  lastName: 'Pérez',
  phoneNumber: '+593991234567',
  countryId: 1,
}

describe('account password rule on the auth DTOs', () => {
  describe('POST /auth/register', () => {
    it('accepts a password with a letter and a digit', async () => {
      const dto = await parse(RegisterDto, { ...REGISTER_BASE, password: 'contraseña1' })
      expect(dto.password).toBe('contraseña1')
    })

    it.each([
      ['only letters', 'abcdefgh'],
      ['only digits', '12345678'],
      ['7 characters', 'abcdef1'],
      ['129 characters', `${'a'.repeat(128)}1`],
    ])('rejects a password with %s', async (_case, password) => {
      const messages = await messagesOf(parse(RegisterDto, { ...REGISTER_BASE, password }))
      expect(messages).toEqual([`password ${RULE}`])
    })
  })

  describe('POST /auth/reset-password', () => {
    const token = 'a-reset-token-long-enough'

    it('accepts a password with a letter and a digit', async () => {
      const dto = await parse(ConfirmPasswordResetDto, { token, password: 'ñandú2026' })
      expect(dto.password).toBe('ñandú2026')
    })

    it('rejects a password without a digit', async () => {
      const messages = await messagesOf(
        parse(ConfirmPasswordResetDto, { token, password: 'abcdefgh' }),
      )
      expect(messages).toEqual([`password ${RULE}`])
    })
  })

  describe('POST /auth/change-password', () => {
    it('accepts a new password with a letter and a digit', async () => {
      const dto = await parse(ChangePasswordDto, {
        currentPassword: 'x',
        newPassword: 'abcdefg1',
      })
      expect(dto.newPassword).toBe('abcdefg1')
    })

    it('rejects a new password without a letter', async () => {
      const messages = await messagesOf(
        parse(ChangePasswordDto, { currentPassword: 'abcdefg1', newPassword: '12345678' }),
      )
      expect(messages).toEqual([`newPassword ${RULE}`])
    })

    it('never applies the rule to the current password', async () => {
      const dto = await parse(ChangePasswordDto, {
        currentPassword: 'oldpass',
        newPassword: 'abcdefg1',
      })
      expect(dto.currentPassword).toBe('oldpass')
    })
  })

  describe('POST /auth/login', () => {
    it('keeps accepting a password set before the rule existed', async () => {
      const dto = await parse(LoginDto, { email: 'buyer@example.com', password: 'abcdefgh' })
      expect(dto.password).toBe('abcdefgh')
    })
  })
})
