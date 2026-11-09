import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { AppException } from '@shared/domain'
import { GetAllCategoriesHandler } from './get-all-categories.handler'
import { GetAllCategoriesQuery } from './get-all-categories.query'

describe('GetAllCategoriesHandler', () => {
  const scope = new EventScope(false, ['t-1'], [])
  const setup = (
    event: { id: string; tenantId: string } | null = { id: 'ev-1', tenantId: 't-2' },
  ) => {
    const readRepo = { getAvailable: jest.fn().mockResolvedValue([]) }
    const eventReadRepo = { findByIdInScope: jest.fn().mockResolvedValue(event) }
    const userRepo = { findTenantId: jest.fn().mockResolvedValue('t-1') }
    const authz = { resolveEventScope: jest.fn().mockResolvedValue(scope) }
    const handler = new GetAllCategoriesHandler(
      readRepo as never,
      eventReadRepo as never,
      userRepo as never,
      authz as never,
    )
    return { handler, readRepo, eventReadRepo, authz }
  }

  it('lists the base set plus the caller tenant categories', async () => {
    const { handler, readRepo, eventReadRepo } = setup()

    await handler.execute(new GetAllCategoriesQuery('u1', null))

    expect(readRepo.getAvailable).toHaveBeenCalledWith('t-1')
    expect(eventReadRepo.findByIdInScope).not.toHaveBeenCalled()
  })

  it('lists for the event organizer when an event is given, within the caller scope', async () => {
    const { handler, readRepo, eventReadRepo, authz } = setup()

    await handler.execute(new GetAllCategoriesQuery('admin', 'ev-1'))

    expect(authz.resolveEventScope).toHaveBeenCalledWith('admin', 'event.read')
    expect(eventReadRepo.findByIdInScope).toHaveBeenCalledWith('ev-1', scope)
    expect(readRepo.getAvailable).toHaveBeenCalledWith('t-2')
  })

  it('answers 404 for an event outside the caller scope', async () => {
    const { handler, readRepo } = setup(null)

    const error = await handler.execute(new GetAllCategoriesQuery('u1', 'ev-x')).catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('NOT_FOUND')
    expect(readRepo.getAvailable).not.toHaveBeenCalled()
  })
})
