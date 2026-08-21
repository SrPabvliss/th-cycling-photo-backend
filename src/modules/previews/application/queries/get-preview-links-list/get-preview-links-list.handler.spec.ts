import type { IPreviewLinkReadRepository } from '@previews/domain/ports'
import { Pagination } from '@shared/application'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { GetPreviewLinksListHandler } from './get-preview-links-list.handler'
import { GetPreviewLinksListQuery } from './get-preview-links-list.query'

describe('GetPreviewLinksListHandler', () => {
  let readRepo: jest.Mocked<Pick<IPreviewLinkReadRepository, 'getListByEvent'>>
  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope'>>
  let handler: GetPreviewLinksListHandler

  beforeEach(() => {
    readRepo = { getListByEvent: jest.fn().mockResolvedValue({ items: [], total: 0 }) }
    authz = { resolveEventScope: jest.fn() }
    handler = new GetPreviewLinksListHandler(readRepo as never, authz as never)
  })

  it('restricts preview links to events within the caller scope', async () => {
    const scope = new EventScope(false, ['tenant-a'], [])
    authz.resolveEventScope.mockResolvedValue(scope)
    const pagination = new Pagination(1, 20)

    await handler.execute(new GetPreviewLinksListQuery('event-1', pagination, 'u1'))

    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(readRepo.getListByEvent).toHaveBeenCalledWith('event-1', pagination, scope)
  })
})
