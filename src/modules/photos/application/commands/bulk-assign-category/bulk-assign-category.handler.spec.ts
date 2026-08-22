import type { IPhotoReadRepository, IPhotoWriteRepository } from '@photos/domain/ports'
import { EventScope } from '@shared/authorization/domain/event-scope.vo'
import type { IAuthorizationService } from '@shared/authorization/domain/ports/authorization.service.port'
import { BulkAssignCategoryCommand } from './bulk-assign-category.command'
import { BulkAssignCategoryHandler } from './bulk-assign-category.handler'

describe('BulkAssignCategoryHandler', () => {
  let handler: BulkAssignCategoryHandler
  let readRepo: jest.Mocked<Pick<IPhotoReadRepository, 'getDistinctEventIdsForPhotoIds'>>
  let writeRepo: jest.Mocked<Pick<IPhotoWriteRepository, 'bulkUpdateCategory'>>
  let authz: jest.Mocked<Pick<IAuthorizationService, 'resolveEventScope' | 'assert'>>
  const scope = EventScope.unrestricted()

  beforeEach(() => {
    readRepo = { getDistinctEventIdsForPhotoIds: jest.fn().mockResolvedValue([]) }
    writeRepo = { bulkUpdateCategory: jest.fn().mockResolvedValue(0) }
    authz = {
      resolveEventScope: jest.fn().mockResolvedValue(scope),
      assert: jest.fn().mockResolvedValue(undefined),
    }
    const freeze = { assertNotFrozen: jest.fn().mockResolvedValue(undefined) }
    handler = new BulkAssignCategoryHandler(
      readRepo as never,
      writeRepo as never,
      authz as never,
      freeze as never,
    )
  })

  it('resolves the caller scope, asserts per affected event, then updates within scope', async () => {
    readRepo.getDistinctEventIdsForPhotoIds.mockResolvedValue(['e-1', 'e-2'])
    writeRepo.bulkUpdateCategory.mockResolvedValue(5)

    const result = await handler.execute(
      new BulkAssignCategoryCommand(['p-1', 'p-2', 'p-3'], 7, 'u1'),
    )

    expect(authz.resolveEventScope).toHaveBeenCalledWith('u1')
    expect(readRepo.getDistinctEventIdsForPhotoIds).toHaveBeenCalledWith(
      ['p-1', 'p-2', 'p-3'],
      scope,
    )
    expect(authz.assert).toHaveBeenCalledWith('u1', 'photo.category.assign', 'e-1')
    expect(authz.assert).toHaveBeenCalledWith('u1', 'photo.category.assign', 'e-2')
    expect(authz.assert).toHaveBeenCalledTimes(2)
    expect(writeRepo.bulkUpdateCategory).toHaveBeenCalledWith(['p-1', 'p-2', 'p-3'], 7, scope)
    expect(result).toEqual({ updated: 5 })
  })

  it('excludes photos outside the caller scope — their event never reaches assert, and the update is itself scope-filtered', async () => {
    // Only e-1 is inside the caller's scope; e-2 (from an out-of-scope
    // photo, e.g. another tenant's) is silently excluded — no error, no
    // enumeration, exactly like a scoped single-entity load returning null.
    const restrictedScope = new EventScope(false, ['t1'], [])
    authz.resolveEventScope.mockResolvedValue(restrictedScope)
    readRepo.getDistinctEventIdsForPhotoIds.mockResolvedValue(['e-1'])
    writeRepo.bulkUpdateCategory.mockResolvedValue(2)

    const result = await handler.execute(new BulkAssignCategoryCommand(['p-1', 'p-2'], 3, 'u2'))

    expect(authz.assert).toHaveBeenCalledWith('u2', 'photo.category.assign', 'e-1')
    expect(authz.assert).toHaveBeenCalledTimes(1)
    expect(writeRepo.bulkUpdateCategory).toHaveBeenCalledWith(['p-1', 'p-2'], 3, restrictedScope)
    expect(result).toEqual({ updated: 2 })
  })

  it('rejects and never writes when the caller is denied on one of the affected events', async () => {
    readRepo.getDistinctEventIdsForPhotoIds.mockResolvedValue(['e-1', 'e-2'])
    authz.assert.mockImplementation((_userId: string, _key: string, eventId: string) =>
      eventId === 'e-2' ? Promise.reject(new Error('Insufficient permissions')) : Promise.resolve(),
    )

    await expect(
      handler.execute(new BulkAssignCategoryCommand(['p-1', 'p-2'], 1, 'u1')),
    ).rejects.toThrow('Insufficient permissions')
    expect(writeRepo.bulkUpdateCategory).not.toHaveBeenCalled()
  })

  it('does no per-event assert and writes nothing when no photo resolves inside scope', async () => {
    readRepo.getDistinctEventIdsForPhotoIds.mockResolvedValue([])
    writeRepo.bulkUpdateCategory.mockResolvedValue(0)

    const result = await handler.execute(new BulkAssignCategoryCommand(['p-1'], 1, 'u1'))

    expect(authz.assert).not.toHaveBeenCalled()
    expect(result).toEqual({ updated: 0 })
  })
})
