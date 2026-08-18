import { ForbiddenException } from '@nestjs/common'
import { TEMPLATE_PERMISSIONS } from '../domain/permission-template.constants'
import { EMPTY_PRINCIPAL_PERMISSIONS, type PrincipalPermissions } from '../domain/principal'
import { AuthorizationService } from './authorization.service'

const repoReturning = (p: PrincipalPermissions) => ({ load: jest.fn().mockResolvedValue(p) })
const cacheReturning = (p: PrincipalPermissions | null) => ({
  get: jest.fn().mockResolvedValue(p),
  set: jest.fn().mockResolvedValue(undefined),
  invalidate: jest.fn().mockResolvedValue(undefined),
})
const noCache = () => cacheReturning(null)

describe('AuthorizationService', () => {
  it('throws on an unknown permission key rather than denying', async () => {
    const svc = new AuthorizationService(repoReturning(EMPTY_PRINCIPAL_PERMISSIONS()), noCache())
    // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid key
    await expect(svc.can('u1', 'event.updte' as any)).rejects.toThrow(/unknown permission/i)
  })

  it('throws for a key colliding with an inherited Object.prototype property', async () => {
    const svc = new AuthorizationService(repoReturning(EMPTY_PRINCIPAL_PERMISSIONS()), noCache())
    await expect(svc.can('u1', 'constructor' as never)).rejects.toThrow(/unknown permission/i)
  })

  it('denies a platform-only permission to a non-platform user holding it in template', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.templateKeys.add('buyer.read')
    p.isPlatform = false
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.can('u1', 'buyer.read')).resolves.toBe(false)
  })

  it('allows a platform-only permission to a platform user', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.templateKeys.add('buyer.read')
    p.isPlatform = true
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.can('u1', 'buyer.read')).resolves.toBe(true)
  })

  it('denies a platform-only permission to a non-platform user even with an explicit global allow grant', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = false
    p.globalGrants.set('buyer.read', 'allow')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.can('u1', 'buyer.read')).resolves.toBe(false)
  })

  it('denies a platform-only permission to a non-platform user even with an explicit event allow grant', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = false
    p.eventGrants.set('e1', new Map([['order.gift', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.can('u1', 'order.gift', 'e1')).resolves.toBe(false)
  })

  it('allows from the template when no grant exists', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.templateKeys.add('event.update')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.can('u1', 'event.update')).resolves.toBe(true)
  })

  it('allows from a global allow grant when the template is empty', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.globalGrants.set('event.update', 'allow')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.can('u1', 'event.update')).resolves.toBe(true)
  })

  it('lets a global deny grant override the template', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.templateKeys.add('event.update')
    p.globalGrants.set('event.update', 'deny')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.can('u1', 'event.update')).resolves.toBe(false)
  })

  it('lets an event deny grant override the template', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.templateKeys.add('event.update')
    p.eventGrants.set('e1', new Map([['event.update', 'deny']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.can('u1', 'event.update', 'e1')).resolves.toBe(false)
  })

  it('lets an event allow grant override a global deny', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.globalGrants.set('event.update', 'deny')
    p.eventGrants.set('e1', new Map([['event.update', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.can('u1', 'event.update', 'e1')).resolves.toBe(true)
  })

  it('does not leak an event grant to a different event', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.eventGrants.set('e1', new Map([['event.update', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.can('u1', 'event.update', 'e2')).resolves.toBe(false)
  })

  it('denies by default', async () => {
    const svc = new AuthorizationService(repoReturning(EMPTY_PRINCIPAL_PERMISSIONS()), noCache())
    await expect(svc.can('u1', 'event.update')).resolves.toBe(false)
  })

  it('assert throws ForbiddenException when denied', async () => {
    const svc = new AuthorizationService(repoReturning(EMPTY_PRINCIPAL_PERMISSIONS()), noCache())
    await expect(svc.assert('u1', 'event.update')).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('uses a cached principal instead of loading from the repository', async () => {
    const cachedPrincipal = EMPTY_PRINCIPAL_PERMISSIONS()
    cachedPrincipal.templateKeys.add('event.update')
    // The repo, if consulted, would deny — proving the answer came from the cache.
    const repo = repoReturning(EMPTY_PRINCIPAL_PERMISSIONS())
    const cache = cacheReturning(cachedPrincipal)
    const svc = new AuthorizationService(repo, cache)
    await expect(svc.can('u1', 'event.update')).resolves.toBe(true)
    expect(repo.load).not.toHaveBeenCalled()
  })

  it('populates the cache with the loaded principal after a cache miss', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    const repo = repoReturning(p)
    const cache = noCache()
    const svc = new AuthorizationService(repo, cache)
    await svc.can('u1', 'event.update')
    expect(cache.set).toHaveBeenCalledWith('u1', p)
  })
})

describe('AuthorizationService.resolveEventScope', () => {
  it('returns all for a holder of event.read.all', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = true
    p.templateKeys.add('event.read.all')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    expect((await svc.resolveEventScope('u1')).toPrisma()).toEqual({})
  })

  it('scopes a tenant user to their own tenant', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.tenantId = 't1'
    const svc = new AuthorizationService(repoReturning(p), noCache())
    expect((await svc.resolveEventScope('u1')).toPrisma()).toEqual({
      OR: [{ tenant_id: { in: ['t1'] } }, { id: { in: [] } }],
    })
  })

  it('includes per-event grants and EventOperator rows', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.eventGrants.set('e1', new Map([['event.read', 'allow']]))
    p.collaboratorEventIds = ['e2']
    const svc = new AuthorizationService(repoReturning(p), noCache())
    const w = (await svc.resolveEventScope('u1')).toPrisma() as {
      OR: [unknown, { id: { in: string[] } }]
    }
    expect(w.OR[1].id.in.sort()).toEqual(['e1', 'e2'])
  })

  it('excludes an event whose grant is a deny', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.eventGrants.set('e1', new Map([['event.read', 'deny']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    const w = (await svc.resolveEventScope('u1')).toPrisma() as {
      OR: [unknown, { id: { in: string[] } }]
    }
    expect(w.OR[1].id.in).toEqual([])
  })

  // Guards against a mutation that grants `all` from `isPlatform` alone,
  // skipping the `event.read.all` check. None of the four tests above catch
  // that: the `isPlatform` fixtures they use either hold `event.read.all` (so
  // both the correct check and the mutant agree) or leave `isPlatform` false
  // (so the mutant never even fires). A restricted TitanTV staff member —
  // `platform_staff` never includes `event.read.all` — must not see every
  // event on the platform just for being platform staff.
  it('does not grant unrestricted scope to a platform_staff-shaped principal', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = true
    for (const key of TEMPLATE_PERMISSIONS.platform_staff) p.templateKeys.add(key)
    const svc = new AuthorizationService(repoReturning(p), noCache())
    const scope = await svc.resolveEventScope('u1')
    expect(scope.all).toBe(false)
    expect(scope.toPrisma()).toEqual({ OR: [{ tenant_id: { in: [] } }, { id: { in: [] } }] })
  })

  it('returns all for a platform user holding event.read.all as a global grant', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = true
    p.globalGrants.set('event.read.all', 'allow')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    expect((await svc.resolveEventScope('u1')).toPrisma()).toEqual({})
  })

  // The cross-tenant leak the review caught: a non-platform (tenant) user
  // can never reach `unrestricted()` via a global `event.read.all` grant,
  // no matter what's in `globalGrants` — `can()`'s platformOnly check denies
  // it before the grant is even consulted. This is the case that a mutant
  // dropping the `isPlatform` guard (or re-deriving the flag by hand instead
  // of delegating to `can()`) would silently let through.
  it('does not grant unrestricted scope to a tenant user holding event.read.all as a global grant', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = false
    p.tenantId = 't1'
    p.globalGrants.set('event.read.all', 'allow')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    const scope = await svc.resolveEventScope('u1')
    expect(scope.all).toBe(false)
    expect(scope.toPrisma()).toEqual({
      OR: [{ tenant_id: { in: ['t1'] } }, { id: { in: [] } }],
    })
  })

  // Semantic change from the pre-fix version: an explicit deny on
  // event.read.all now overrides the template, matching can()'s documented
  // precedence (grant beats template) instead of short-circuiting to
  // unrestricted() just because the template holds the key.
  it('lets an explicit deny on event.read.all override the template', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = true
    p.templateKeys.add('event.read.all')
    p.globalGrants.set('event.read.all', 'deny')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    const scope = await svc.resolveEventScope('u1')
    expect(scope.all).toBe(false)
    expect(scope.toPrisma()).toEqual({ OR: [{ tenant_id: { in: [] } }, { id: { in: [] } }] })
  })
})
