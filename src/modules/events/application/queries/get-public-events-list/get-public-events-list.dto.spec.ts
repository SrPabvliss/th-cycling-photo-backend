import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { GetPublicEventsListDto } from './get-public-events-list.dto'

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
})

function parse(query: Record<string, string>): Promise<GetPublicEventsListDto> {
  return pipe.transform(query, { type: 'query', metatype: GetPublicEventsListDto })
}

describe('GetPublicEventsListDto', () => {
  it('accepts a request without filters', async () => {
    const dto = await parse({})

    expect(dto.search).toBeUndefined()
    expect(dto.eventTypeId).toBeUndefined()
    expect(dto.hasPhotos).toBeUndefined()
  })

  it('trims the search term', async () => {
    expect((await parse({ search: '  cotopaxi  ' })).search).toBe('cotopaxi')
  })

  it('rejects a search of one character', async () => {
    await expect(parse({ search: 'a' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects a search that is one character once trimmed', async () => {
    await expect(parse({ search: ' a ' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects a search longer than 100 characters', async () => {
    await expect(parse({ search: 'a'.repeat(101) })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('accepts a search of exactly 2 and exactly 100 characters', async () => {
    expect((await parse({ search: 'ab' })).search).toBe('ab')
    expect((await parse({ search: 'a'.repeat(100) })).search).toHaveLength(100)
  })

  it('reads eventTypeId as an integer', async () => {
    expect((await parse({ eventTypeId: '3' })).eventTypeId).toBe(3)
  })

  it('rejects an eventTypeId that is not a positive integer', async () => {
    await expect(parse({ eventTypeId: 'abc' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(parse({ eventTypeId: '0' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(parse({ eventTypeId: '1.5' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('reads hasPhotos=true as true', async () => {
    expect((await parse({ hasPhotos: 'true' })).hasPhotos).toBe(true)
  })

  it('reads hasPhotos=false as false, never as true', async () => {
    expect((await parse({ hasPhotos: 'false' })).hasPhotos).toBe(false)
  })

  it('rejects any other hasPhotos value', async () => {
    await expect(parse({ hasPhotos: 'yes' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(parse({ hasPhotos: '1' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(parse({ hasPhotos: '' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects the filters that are not part of the contract', async () => {
    await expect(parse({ provinceId: '1' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(parse({ dateFrom: '2026-01-01' })).rejects.toBeInstanceOf(BadRequestException)
  })
})
