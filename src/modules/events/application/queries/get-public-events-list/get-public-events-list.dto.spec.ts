import { BadRequestException, ValidationPipe } from '@nestjs/common'
import {
  GetPublicEventsListDto,
  PublicEventListFiltersDto,
  toPublicEventListFilters,
} from './get-public-events-list.dto'

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
})

function parse(query: Record<string, string | string[]>): Promise<GetPublicEventsListDto> {
  return pipe.transform(query, { type: 'query', metatype: GetPublicEventsListDto })
}

function parseFilters(query: Record<string, string>): Promise<PublicEventListFiltersDto> {
  return pipe.transform(query, { type: 'query', metatype: PublicEventListFiltersDto })
}

async function rejects(query: Record<string, string | string[]>) {
  await expect(parse(query)).rejects.toBeInstanceOf(BadRequestException)
}

describe('GetPublicEventsListDto', () => {
  it('accepts a request without filters', async () => {
    const dto = await parse({})

    expect(dto.search).toBeUndefined()
    expect(dto.eventTypeIds).toBeUndefined()
    expect(dto.provinceIds).toBeUndefined()
    expect(dto.from).toBeUndefined()
    expect(dto.to).toBeUndefined()
  })

  describe('search', () => {
    it('trims the search term', async () => {
      expect((await parse({ search: '  cotopaxi  ' })).search).toBe('cotopaxi')
    })

    it('rejects a search of one character, also once trimmed', async () => {
      await rejects({ search: 'a' })
      await rejects({ search: ' a ' })
    })

    it('rejects a search longer than 100 characters', async () => {
      await rejects({ search: 'a'.repeat(101) })
    })

    it('accepts a search of exactly 2 and exactly 100 characters', async () => {
      expect((await parse({ search: 'ab' })).search).toBe('ab')
      expect((await parse({ search: 'a'.repeat(100) })).search).toHaveLength(100)
    })
  })

  describe.each(['eventTypeIds', 'provinceIds'] as const)('%s', (field) => {
    it('reads a single id as a one-item list', async () => {
      expect((await parse({ [field]: '3' }))[field]).toEqual([3])
    })

    it('reads ids separated by commas, keeping their order', async () => {
      expect((await parse({ [field]: '7,1,12' }))[field]).toEqual([7, 1, 12])
    })

    it('accepts 20 ids and rejects 21', async () => {
      const ids = Array.from({ length: 21 }, (_, index) => String(index + 1))
      expect((await parse({ [field]: ids.slice(0, 20).join(',') }))[field]).toHaveLength(20)
      await rejects({ [field]: ids.join(',') })
    })

    it('rejects a repeated id', async () => {
      await rejects({ [field]: '1,2,1' })
    })

    it('rejects ids that are not positive integers', async () => {
      await rejects({ [field]: '0' })
      await rejects({ [field]: '-1' })
      await rejects({ [field]: '1.5' })
      await rejects({ [field]: 'abc' })
      await rejects({ [field]: '1,x' })
      await rejects({ [field]: '1e3' })
    })

    it('rejects an id beyond the integer column range', async () => {
      await rejects({ [field]: '2147483648' })
    })

    it('rejects an empty value and empty items', async () => {
      await rejects({ [field]: '' })
      await rejects({ [field]: '1,,2' })
      await rejects({ [field]: '1,' })
      await rejects({ [field]: ',1' })
    })

    it('rejects ids with spaces', async () => {
      await rejects({ [field]: '1, 2' })
    })

    it('rejects the parameter sent more than once', async () => {
      await rejects({ [field]: ['1', '2'] })
    })
  })

  describe('from and to', () => {
    it('accepts a month range', async () => {
      const dto = await parse({ from: '2026-06', to: '2026-08' })

      expect(dto.from).toBe('2026-06')
      expect(dto.to).toBe('2026-08')
    })

    it('accepts the same month on both ends', async () => {
      expect(await parse({ from: '2026-06', to: '2026-06' })).toMatchObject({
        from: '2026-06',
        to: '2026-06',
      })
    })

    it('accepts a range that crosses the year', async () => {
      expect((await parse({ from: '2025-12', to: '2026-01' })).to).toBe('2026-01')
    })

    it('accepts months 01 and 12', async () => {
      expect((await parse({ from: '2026-01', to: '2026-12' })).from).toBe('2026-01')
    })

    it('rejects month 13 and month 00', async () => {
      await rejects({ from: '2026-13' })
      await rejects({ to: '2026-00' })
    })

    it('rejects any shape other than YYYY-MM', async () => {
      await rejects({ from: '2026-6' })
      await rejects({ from: '2026-06-01' })
      await rejects({ from: '26-06' })
      await rejects({ from: '2026/06' })
      await rejects({ from: '' })
      await rejects({ to: 'junio' })
    })

    it('rejects a to earlier than from', async () => {
      await rejects({ from: '2026-08', to: '2026-06' })
      await rejects({ from: '2026-01', to: '2025-12' })
    })

    it('accepts only from, or only to', async () => {
      expect((await parse({ from: '2026-06' })).from).toBe('2026-06')
      expect((await parse({ to: '2026-06' })).to).toBe('2026-06')
    })
  })

  it('rejects the filters that are no longer part of the contract', async () => {
    await rejects({ hasPhotos: 'true' })
    await rejects({ eventTypeId: '1' })
    await rejects({ provinceId: '1' })
    await rejects({ dateFrom: '2026-01-01' })
  })
})

describe('PublicEventListFiltersDto', () => {
  it('accepts the same filters as the list', async () => {
    const dto = await parseFilters({
      search: 'ruta',
      eventTypeIds: '1,2',
      provinceIds: '3',
      from: '2026-06',
      to: '2026-08',
    })

    expect(dto).toMatchObject({
      search: 'ruta',
      eventTypeIds: [1, 2],
      provinceIds: [3],
      from: '2026-06',
      to: '2026-08',
    })
  })

  it('rejects pagination, which only the list takes', async () => {
    await expect(parseFilters({ page: '1' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('applies the same rules as the list', async () => {
    await expect(parseFilters({ eventTypeIds: '1,1' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(parseFilters({ from: '2026-08', to: '2026-06' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})

describe('toPublicEventListFilters', () => {
  it('turns missing filters into nulls and empty lists', () => {
    expect(toPublicEventListFilters({})).toEqual({
      search: null,
      eventTypeIds: [],
      provinceIds: [],
      from: null,
      to: null,
    })
  })

  it('passes every filter through', () => {
    expect(
      toPublicEventListFilters({
        search: 'ruta',
        eventTypeIds: [1, 2],
        provinceIds: [3],
        from: '2026-06',
        to: '2026-08',
      }),
    ).toEqual({
      search: 'ruta',
      eventTypeIds: [1, 2],
      provinceIds: [3],
      from: '2026-06',
      to: '2026-08',
    })
  })

  it('closes a range given only from on that same month', () => {
    expect(toPublicEventListFilters({ from: '2026-06' })).toMatchObject({
      from: '2026-06',
      to: '2026-06',
    })
  })

  it('closes a range given only to on that same month', () => {
    expect(toPublicEventListFilters({ to: '2026-06' })).toMatchObject({
      from: '2026-06',
      to: '2026-06',
    })
  })
})
