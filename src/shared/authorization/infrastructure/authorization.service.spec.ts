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

describe('AuthorizationService.canAnywhere', () => {
  it('allows a key held only on one event, for the coarse route check', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.eventGrants.set('e1', new Map([['photo.retouch.upload', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.canAnywhere('u1', 'photo.retouch.upload')).resolves.toBe(true)
    await expect(svc.can('u1', 'photo.retouch.upload', 'e2')).resolves.toBe(false)
  })

  it('allows from the template without any event grant', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.templateKeys.add('event.read')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.canAnywhere('u1', 'event.read')).resolves.toBe(true)
  })

  it('ignores event deny grants', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.eventGrants.set('e1', new Map([['photo.retouch.upload', 'deny']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.canAnywhere('u1', 'photo.retouch.upload')).resolves.toBe(false)
  })

  it('keeps platform-only keys out of reach for a non-platform user with an event grant', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.eventGrants.set('e1', new Map([['photo.retouch.read', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.canAnywhere('u1', 'photo.retouch.read')).resolves.toBe(false)
  })

  it('allows a platform-only key held on an event by a platform user', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = true
    p.eventGrants.set('e1', new Map([['photo.retouch.read', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    await expect(svc.canAnywhere('u1', 'photo.retouch.read')).resolves.toBe(true)
  })
})

const tenantPrincipal = (keys: string[] = []): PrincipalPermissions => {
  const p = EMPTY_PRINCIPAL_PERMISSIONS()
  p.tenantId = 't1'
  for (const key of keys) p.templateKeys.add(key as never)
  return p
}

describe('AuthorizationService.resolveEventScope', () => {
  it('returns all for a holder of event.read.all, whatever the key', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = true
    p.templateKeys.add('event.read.all')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    expect((await svc.resolveEventScope('u1', 'order.read')).toPrisma()).toEqual({})
  })

  it('returns all for a platform user holding event.read.all as a global grant', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = true
    p.globalGrants.set('event.read.all', 'allow')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    expect((await svc.resolveEventScope('u1', 'event.read')).toPrisma()).toEqual({})
  })

  it('scopes a tenant user holding the key in the template to their own tenant', async () => {
    const svc = new AuthorizationService(repoReturning(tenantPrincipal(['event.read'])), noCache())
    expect((await svc.resolveEventScope('u1', 'event.read')).toPrisma()).toEqual({
      OR: [{ tenant_id: { in: ['t1'] } }, { id: { in: [] } }],
    })
  })

  it('does not open the tenant to a user whose only reach is a grant on one event', async () => {
    const p = tenantPrincipal()
    p.eventGrants.set('e1', new Map([['event.read', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    const scope = await svc.resolveEventScope('u1', 'event.read')
    expect(scope.tenantIds).toEqual([])
    expect(scope.eventIds).toEqual(['e1'])
    expect(scope.includesEvent({ id: 'e2', tenantId: 't1' })).toBe(false)
  })

  it('opens the tenant through a global allow grant', async () => {
    const p = tenantPrincipal()
    p.globalGrants.set('order.read', 'allow')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    expect((await svc.resolveEventScope('u1', 'order.read')).tenantIds).toEqual(['t1'])
  })

  it('closes the tenant when a global deny overrides the template', async () => {
    const p = tenantPrincipal(['order.read'])
    p.globalGrants.set('order.read', 'deny')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    expect((await svc.resolveEventScope('u1', 'order.read')).isEmpty).toBe(true)
  })

  it('does not let a grant of one verb reach another verb', async () => {
    const p = tenantPrincipal()
    p.eventGrants.set('e1', new Map([['photo.read', 'allow']]))
    p.eventGrants.set('e2', new Map([['order.read', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    expect((await svc.resolveEventScope('u1', 'order.read')).eventIds).toEqual(['e2'])
    expect((await svc.resolveEventScope('u1', 'photo.read')).eventIds).toEqual(['e1'])
  })

  it('carves an explicit per-event deny out of the tenant branch', async () => {
    const p = tenantPrincipal(['photo.read'])
    p.eventGrants.set('e1', new Map([['photo.read', 'deny']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    const scope = await svc.resolveEventScope('u1', 'photo.read')
    expect(scope.deniedEventIds).toEqual(['e1'])
    expect(scope.includesEvent({ id: 'e1', tenantId: 't1' })).toBe(false)
    expect(scope.includesEvent({ id: 'e2', tenantId: 't1' })).toBe(true)
  })

  it('ignores a deny of a different verb', async () => {
    const p = tenantPrincipal(['photo.read'])
    p.eventGrants.set('e1', new Map([['order.read', 'deny']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    expect((await svc.resolveEventScope('u1', 'photo.read')).deniedEventIds).toEqual([])
  })

  it('narrows a retoucher holding the key only on events to exactly those events', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = true
    p.tenantId = 'platform'
    for (const key of TEMPLATE_PERMISSIONS.platform_staff) p.templateKeys.add(key)
    p.eventGrants.set('e1', new Map([['photo.retouch.read', 'allow']]))
    p.eventGrants.set('e2', new Map([['photo.retouch.read', 'deny']]))
    p.eventGrants.set('e3', new Map([['photo.retouch.flag', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())

    const scope = await svc.resolveEventScope('u1', 'photo.retouch.read')

    expect(scope.all).toBe(false)
    expect(scope.tenantIds).toEqual([])
    expect(scope.eventIds).toEqual(['e1'])
  })

  it('unions several keys so a retoucher reads the photos of the events they retouch', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = true
    p.tenantId = 'platform'
    for (const key of TEMPLATE_PERMISSIONS.platform_staff) p.templateKeys.add(key)
    p.eventGrants.set('eB', new Map([['photo.retouch.read', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())

    const read = await svc.resolveEventScope('u1', 'photo.read')
    const union = await svc.resolveEventScope('u1', ['photo.read', 'photo.retouch.read'])

    expect(read.includesEvent({ id: 'eB', tenantId: 'tB' })).toBe(false)
    expect(union.includesEvent({ id: 'eB', tenantId: 'tB' })).toBe(true)
    expect(union.includesEvent({ id: 'eP', tenantId: 'platform' })).toBe(true)
    expect(union.includesEvent({ id: 'eX', tenantId: 'tB' })).toBe(false)
  })

  it('returns an empty scope for a platform-only key held by a tenant user', async () => {
    const p = tenantPrincipal(['buyer.read'])
    p.eventGrants.set('e1', new Map([['buyer.read', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache())
    expect((await svc.resolveEventScope('u1', 'buyer.read')).isEmpty).toBe(true)
  })

  // Guards against a mutation that grants `all` from `isPlatform` alone.
  it('does not grant unrestricted scope to a platform_staff-shaped principal', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = true
    for (const key of TEMPLATE_PERMISSIONS.platform_staff) p.templateKeys.add(key)
    const svc = new AuthorizationService(repoReturning(p), noCache())
    const scope = await svc.resolveEventScope('u1', 'event.read')
    expect(scope.all).toBe(false)
    expect(scope.toPrisma()).toEqual({ OR: [{ tenant_id: { in: [] } }, { id: { in: [] } }] })
  })

  // A tenant user can never reach `unrestricted()` through a global `event.read.all` grant —
  // `can()`'s platformOnly check denies it first.
  it('does not grant unrestricted scope to a tenant user holding event.read.all as a global grant', async () => {
    const p = tenantPrincipal(['event.read'])
    p.globalGrants.set('event.read.all', 'allow')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    const scope = await svc.resolveEventScope('u1', 'event.read')
    expect(scope.all).toBe(false)
    expect(scope.toPrisma()).toEqual({
      OR: [{ tenant_id: { in: ['t1'] } }, { id: { in: [] } }],
    })
  })

  it('lets an explicit deny on event.read.all override the template', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = true
    p.templateKeys.add('event.read.all')
    p.globalGrants.set('event.read.all', 'deny')
    const svc = new AuthorizationService(repoReturning(p), noCache())
    const scope = await svc.resolveEventScope('u1', 'event.read')
    expect(scope.all).toBe(false)
    expect(scope.toPrisma()).toEqual({ OR: [{ tenant_id: { in: [] } }, { id: { in: [] } }] })
  })
})
