import { createHmac } from 'node:crypto'
import type { ConfigService } from '@nestjs/config'
import { CdnUrlBuilder } from './cdn-url.builder'

describe('CdnUrlBuilder.internalUrl', () => {
  const NOW = new Date('2026-11-12T12:00:00Z')
  const NOW_SECONDS = Math.floor(NOW.getTime() / 1000)
  const SECRET = 'test-hmac-secret'

  const builder = new CdnUrlBuilder({
    getOrThrow: (key: string) =>
      key === 'storage.cdnUrl' ? 'https://cdn.test' : key === 'cloudflare.hmacSecret' ? SECRET : '',
  } as unknown as ConfigService)

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime())
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const parse = (url: string) => {
    const parsed = new URL(url)
    const [expiration, hmac] = (parsed.searchParams.get('token') ?? '').split('-')
    return { pathname: parsed.pathname, expiration: Number(expiration), hmac }
  }

  const signatureFor = (pathname: string, expiration: number) =>
    createHmac('sha256', SECRET).update(`${pathname}${expiration}`).digest('hex')

  it('signs a preset URL that expires in ten minutes by default', () => {
    const { pathname, expiration, hmac } = parse(builder.internalUrl('abc123', 'thumb'))

    expect(pathname).toBe('/internal/thumb/abc123.jpg')
    expect(expiration).toBe(NOW_SECONDS + 600)
    expect(hmac).toBe(signatureFor(pathname, expiration))
  })

  it('keeps the unpreset path and the default lifetime when only a slug is given', () => {
    const { pathname, expiration } = parse(builder.internalUrl('abc123'))

    expect(pathname).toBe('/internal/abc123.jpg')
    expect(expiration).toBe(NOW_SECONDS + 600)
  })

  it('signs for the lifetime it is asked for, in the shape the Worker validates', () => {
    const { pathname, expiration, hmac } = parse(builder.internalUrl('abc123', 'thumb', 3600))

    expect(expiration).toBe(NOW_SECONDS + 3600)
    expect(hmac).toBe(signatureFor(pathname, expiration))
  })
})
