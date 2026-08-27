import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import { GetGalleryFacetsHandler } from './get-gallery-facets.handler'
import { GetGalleryFacetsQuery } from './get-gallery-facets.query'

describe('GetGalleryFacetsHandler', () => {
  it('resolves the caller scope before asking the repository for counts', async () => {
    const scope = new EventScope(false, ['t1'], [])
    const authz = { resolveEventScope: jest.fn().mockResolvedValue(scope) } as never
    const readRepo = { getGalleryFacets: jest.fn().mockResolvedValue({ total: 0 }) } as never
    const handler = new GetGalleryFacetsHandler(readRepo, authz)

    await handler.execute(new GetGalleryFacetsQuery('event-1', 'u1'))

    expect(
      (authz as never as { resolveEventScope: jest.Mock }).resolveEventScope,
    ).toHaveBeenCalledWith('u1')
    expect(
      (readRepo as never as { getGalleryFacets: jest.Mock }).getGalleryFacets,
    ).toHaveBeenCalledWith('event-1', scope)
  })
})
