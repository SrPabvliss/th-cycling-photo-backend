import { ParseUUIDPipe } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PERMISSION_KEY } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import type { GetBuyersListDto } from '@users/application/queries'
import { GetBuyersListQuery, GetBuyersStatsQuery } from '@users/application/queries'
import { BuyersController } from './buyers.controller'

describe('BuyersController', () => {
  const reflector = new Reflector()

  function buildController() {
    const execute = jest.fn().mockResolvedValue(undefined)
    const controller = new BuyersController({ execute } as never)
    return { controller, execute }
  }

  it('requires buyer.read on every route', () => {
    const getPermission = (methodName: keyof BuyersController): string | undefined => {
      const handler = BuyersController.prototype[methodName] as unknown as (
        ...args: unknown[]
      ) => unknown
      return reflector.get<string>(PERMISSION_KEY, handler)
    }

    expect(getPermission('findAll')).toBe('buyer.read')
    expect(getPermission('stats')).toBe('buyer.read')
    expect(getPermission('findOne')).toBe('buyer.read')
  })

  it('parses the id param with ParseUUIDPipe, so a malformed id 400s instead of reaching Prisma', () => {
    const pipes = Reflect.getMetadata('__routeArguments__', BuyersController, 'findOne')
    const paramMetadata = Object.values(pipes ?? {}).find(
      (entry): entry is { pipes: unknown[] } =>
        typeof entry === 'object' && entry !== null && 'pipes' in entry,
    )
    const usesUuidPipe = paramMetadata?.pipes.some(
      (pipe) => pipe === ParseUUIDPipe || pipe instanceof ParseUUIDPipe,
    )

    expect(usesUuidPipe).toBe(true)
  })

  it('resolves registeredTo to the last instant of that day in Ecuador, not UTC midnight', async () => {
    const { controller, execute } = buildController()
    const dto = { registeredTo: '2026-08-23' } as GetBuyersListDto

    await controller.findAll(dto)

    const query = execute.mock.calls[0][0] as GetBuyersListQuery
    expect(query.filters.registeredTo?.toISOString()).toBe('2026-08-24T04:59:59.999Z')
  })

  it('resolves registeredFrom to the first instant of that day in Ecuador, not UTC midnight', async () => {
    const { controller, execute } = buildController()
    const dto = { registeredFrom: '2026-08-23' } as GetBuyersListDto

    await controller.findAll(dto)

    const query = execute.mock.calls[0][0] as GetBuyersListQuery
    expect(query.filters.registeredFrom?.toISOString()).toBe('2026-08-23T05:00:00.000Z')
  })

  it('applies the same registeredTo conversion to the stats endpoint', async () => {
    const { controller, execute } = buildController()
    const dto = { registeredTo: '2026-12-31' } as GetBuyersListDto

    await controller.stats(dto)

    const query = execute.mock.calls[0][0] as GetBuyersStatsQuery
    expect(query.filters.registeredTo?.toISOString()).toBe('2027-01-01T04:59:59.999Z')
  })

  it('a same-day range includes a midday registration and excludes one the evening before', async () => {
    const { controller, execute } = buildController()
    const dto = { registeredFrom: '2026-08-20', registeredTo: '2026-08-25' } as GetBuyersListDto

    await controller.findAll(dto)

    const query = execute.mock.calls[0][0] as GetBuyersListQuery
    const rangeStart = query.filters.registeredFrom as Date
    const rangeEnd = query.filters.registeredTo as Date

    const midday20th = new Date('2026-08-20T15:00:00.000-05:00')
    const evening19th = new Date('2026-08-19T19:00:00.000-05:00')

    expect(midday20th >= rangeStart && midday20th <= rangeEnd).toBe(true)
    expect(evening19th >= rangeStart && evening19th <= rangeEnd).toBe(false)
  })
})
