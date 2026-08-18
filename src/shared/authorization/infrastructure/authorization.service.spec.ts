import { ForbiddenException } from '@nestjs/common'
import { EMPTY_PRINCIPAL_PERMISSIONS, type PrincipalPermissions } from '../domain/principal'
import { AuthorizationService } from './authorization.service'

const repoReturning = (p: PrincipalPermissions) => ({ load: jest.fn().mockResolvedValue(p) })
const noCache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), invalidate: jest.fn() }

describe('AuthorizationService', () => {
  it('throws on an unknown permission key rather than denying', async () => {
    const svc = new AuthorizationService(repoReturning(EMPTY_PRINCIPAL_PERMISSIONS()), noCache)
    // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid key
    await expect(svc.can('u1', 'event.updte' as any)).rejects.toThrow(/unknown permission/i)
  })

  it('denies a platform-only permission to a non-platform user holding it in template', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.templateKeys.add('buyer.read')
    p.isPlatform = false
    const svc = new AuthorizationService(repoReturning(p), noCache)
    await expect(svc.can('u1', 'buyer.read')).resolves.toBe(false)
  })

  it('allows a platform-only permission to a platform user', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.templateKeys.add('buyer.read')
    p.isPlatform = true
    const svc = new AuthorizationService(repoReturning(p), noCache)
    await expect(svc.can('u1', 'buyer.read')).resolves.toBe(true)
  })

  it('denies a platform-only permission to a non-platform user even with an explicit global allow grant', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = false
    p.globalGrants.set('buyer.read', 'allow')
    const svc = new AuthorizationService(repoReturning(p), noCache)
    await expect(svc.can('u1', 'buyer.read')).resolves.toBe(false)
  })

  it('denies a platform-only permission to a non-platform user even with an explicit event allow grant', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.isPlatform = false
    p.eventGrants.set('e1', new Map([['order.gift', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache)
    await expect(svc.can('u1', 'order.gift', 'e1')).resolves.toBe(false)
  })

  it('allows from the template when no grant exists', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.templateKeys.add('event.update')
    const svc = new AuthorizationService(repoReturning(p), noCache)
    await expect(svc.can('u1', 'event.update')).resolves.toBe(true)
  })

  it('lets a global deny grant override the template', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.templateKeys.add('event.update')
    p.globalGrants.set('event.update', 'deny')
    const svc = new AuthorizationService(repoReturning(p), noCache)
    await expect(svc.can('u1', 'event.update')).resolves.toBe(false)
  })

  it('lets an event allow grant override a global deny', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.globalGrants.set('event.update', 'deny')
    p.eventGrants.set('e1', new Map([['event.update', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache)
    await expect(svc.can('u1', 'event.update', 'e1')).resolves.toBe(true)
  })

  it('does not leak an event grant to a different event', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.eventGrants.set('e1', new Map([['event.update', 'allow']]))
    const svc = new AuthorizationService(repoReturning(p), noCache)
    await expect(svc.can('u1', 'event.update', 'e2')).resolves.toBe(false)
  })

  it('denies by default', async () => {
    const svc = new AuthorizationService(repoReturning(EMPTY_PRINCIPAL_PERMISSIONS()), noCache)
    await expect(svc.can('u1', 'event.update')).resolves.toBe(false)
  })

  it('assert throws ForbiddenException when denied', async () => {
    const svc = new AuthorizationService(repoReturning(EMPTY_PRINCIPAL_PERMISSIONS()), noCache)
    await expect(svc.assert('u1', 'event.update')).rejects.toBeInstanceOf(ForbiddenException)
  })
})
