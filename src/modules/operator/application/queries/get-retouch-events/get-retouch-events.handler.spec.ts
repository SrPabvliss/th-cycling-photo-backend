import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { GetRetouchEventsHandler } from './get-retouch-events.handler'
import { GetRetouchEventsQuery } from './get-retouch-events.query'

describe('GetRetouchEventsHandler', () => {
  const setup = (scope: EventScope) => {
    const retouchRead = { findRetouchableEvents: jest.fn().mockResolvedValue([{ id: 'e1' }]) }
    const authz = { resolveEventScope: jest.fn().mockResolvedValue(scope) }
    const handler = new GetRetouchEventsHandler(retouchRead as never, authz as never)
    return { handler, retouchRead, authz }
  }

  it('lists the events within the photo.retouch.read scope', async () => {
    const scope = new EventScope(false, [], ['e1'])
    const { handler, retouchRead, authz } = setup(scope)

    await expect(handler.execute(new GetRetouchEventsQuery('u1'))).resolves.toEqual([{ id: 'e1' }])
    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1', 'photo.retouch.read')
    expect(retouchRead.findRetouchableEvents).toHaveBeenCalledWith(scope)
  })

  it('skips the query when the caller retouches nowhere', async () => {
    const { handler, retouchRead } = setup(EventScope.empty())

    await expect(handler.execute(new GetRetouchEventsQuery('u1'))).resolves.toEqual([])
    expect(retouchRead.findRetouchableEvents).not.toHaveBeenCalled()
  })
})
