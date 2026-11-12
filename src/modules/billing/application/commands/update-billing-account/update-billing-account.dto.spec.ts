import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { UpdateBillingAccountDto } from './update-billing-account.dto'

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
})

function parse(body: Record<string, unknown>): Promise<UpdateBillingAccountDto> {
  return pipe.transform(body, { type: 'body', metatype: UpdateBillingAccountDto })
}

describe('UpdateBillingAccountDto', () => {
  it('accepts an empty body', async () => {
    expect(await parse({})).toEqual({})
  })

  it('accepts any single text field on its own', async () => {
    expect((await parse({ legalName: 'Juan Pérez' })).legalName).toBe('Juan Pérez')
    expect((await parse({ email: 'juan@correo.com' })).email).toBe('juan@correo.com')
    expect((await parse({ address: 'Av. Amazonas' })).address).toBe('Av. Amazonas')
  })

  it('accepts idType and idNumber together', async () => {
    const dto = await parse({ idType: 'ruc', idNumber: '1790012345001' })

    expect(dto.idType).toBe('ruc')
    expect(dto.idNumber).toBe('1790012345001')
  })

  it('rejects idType without idNumber', async () => {
    await expect(parse({ idType: 'ruc' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects idNumber without idType', async () => {
    await expect(parse({ idNumber: '1790012345001' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects an unknown idType', async () => {
    await expect(parse({ idType: 'dni', idNumber: '123' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('keeps address null, which means clear it', async () => {
    const dto = await parse({ address: null })

    expect(dto.address).toBeNull()
  })

  it('rejects null for the fields that cannot be cleared', async () => {
    await expect(parse({ legalName: null })).rejects.toBeInstanceOf(BadRequestException)
    await expect(parse({ email: null })).rejects.toBeInstanceOf(BadRequestException)
    await expect(parse({ idType: null, idNumber: null })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('rejects a malformed email and over-long texts', async () => {
    await expect(parse({ email: 'no-es-correo' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(parse({ legalName: 'a'.repeat(301) })).rejects.toBeInstanceOf(BadRequestException)
    await expect(parse({ address: 'a'.repeat(301) })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects fields that are not part of the contract', async () => {
    await expect(parse({ isDefault: true })).rejects.toBeInstanceOf(BadRequestException)
    await expect(parse({ userId: 'someone-else' })).rejects.toBeInstanceOf(BadRequestException)
  })
})
