import { AppException } from '@shared/domain'
import type { IYupanaClient } from '@shared/yupana/domain/ports'
import { ReadCostsHandler } from './read-costs.handler'
import { ReadCostsQuery } from './read-costs.query'

describe('ReadCostsHandler', () => {
  const client = {
    isConfigured: jest.fn(() => true),
    sendReports: jest.fn(),
    sendDeclarations: jest.fn(),
    read: jest.fn<Promise<unknown>, [string, Record<string, string | undefined>]>(async () => ({
      ok: true,
    })),
  } satisfies jest.Mocked<IYupanaClient>

  const handler = () => new ReadCostsHandler(client)

  beforeEach(() => {
    jest.clearAllMocks()
    client.isConfigured.mockReturnValue(true)
  })

  it('reads one event with its environment', async () => {
    const data = await handler().execute(
      new ReadCostsQuery('event', { id: 'ev-1', environment: 'dev' }),
    )

    expect(client.read).toHaveBeenCalledWith('/costs/events/ev-1', { environment: 'dev' })
    expect(data).toEqual({ ok: true })
  })

  it.each([
    [
      'summary',
      { month: '2026-11', environment: 'dev', pricing: 'list' },
      '/costs/periods/summary',
    ],
    ['health', {}, '/health'],
    ['events', { month: '2026-11', environment: 'dev' }, '/costs/events'],
    ['photo', { id: 'ph-1' }, '/costs/photos/ph-1'],
  ] as const)('reads %s from its yupana route', async (resource, params, path) => {
    await handler().execute(new ReadCostsQuery(resource, params))

    const { id: _id, ...query } = params as Record<string, string>
    expect(client.read).toHaveBeenCalledWith(path, query)
  })

  it('escapes the id it puts in the path', async () => {
    await handler().execute(new ReadCostsQuery('photo', { id: '../health' }))

    expect(client.read).toHaveBeenCalledWith('/costs/photos/..%2Fhealth', {})
  })

  it('fails as an external service when yupana is not configured', async () => {
    client.isConfigured.mockReturnValue(false)

    await expect(handler().execute(new ReadCostsQuery('health', {}))).rejects.toBeInstanceOf(
      AppException,
    )
    expect(client.read).not.toHaveBeenCalled()
  })
})
