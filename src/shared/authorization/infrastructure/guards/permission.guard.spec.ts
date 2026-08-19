import type { ExecutionContext } from '@nestjs/common'
import { ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Public } from '@shared/auth'
import type { IAuthorizationService } from '../../domain/ports/authorization.service.port'
import { Authenticated } from '../../presentation/decorators/authenticated.decorator'
import { RequirePermission } from '../../presentation/decorators/require-permission.decorator'
import { PermissionGuard } from './permission.guard'

class PublicController {
  @Public()
  publicRoute() {}
}

class AuthenticatedController {
  @Authenticated()
  ownResourceRoute() {}
}

class PermissionController {
  @RequirePermission('event.read')
  permissionedRoute() {}
}

class UnmarkedController {
  // Deliberately undecorated: this is the "forgot to classify the route" case.
  unmarkedRoute() {}
}

@Public()
class ClassLevelPublicController {
  // No method-level marker: the class-level @Public() must still apply.
  inheritedRoute() {}
}

const contextFor = (
  // biome-ignore lint/suspicious/noExplicitAny: stand-in for a real controller method reference
  handler: any,
  // biome-ignore lint/suspicious/noExplicitAny: stand-in for a real controller class reference
  klass: any,
  user?: { userId: string },
): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext

const authzReturning = (result: boolean): IAuthorizationService => ({
  can: jest.fn().mockResolvedValue(result),
  assert: jest.fn(),
  resolveEventScope: jest.fn(),
})

describe('PermissionGuard', () => {
  const reflector = new Reflector()

  it('allows a @Public() route without consulting the authorization service or request.user', async () => {
    const authz = authzReturning(false)
    const guard = new PermissionGuard(reflector, authz)
    const ctx = contextFor(PublicController.prototype.publicRoute, PublicController)

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    expect(authz.can).not.toHaveBeenCalled()
  })

  it('allows an @Authenticated() route without an authorization decision', async () => {
    const authz = authzReturning(false)
    const guard = new PermissionGuard(reflector, authz)
    const ctx = contextFor(
      AuthenticatedController.prototype.ownResourceRoute,
      AuthenticatedController,
      { userId: 'u1' },
    )

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    expect(authz.can).not.toHaveBeenCalled()
  })

  // The single behaviour the guard exists for: an unmarked route is never silently reachable.
  it('denies a route with no marker at all, fail closed, without consulting the authorization service', async () => {
    const authz = authzReturning(true)
    const guard = new PermissionGuard(reflector, authz)
    const ctx = contextFor(UnmarkedController.prototype.unmarkedRoute, UnmarkedController, {
      userId: 'u1',
    })

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException)
    expect(authz.can).not.toHaveBeenCalled()
  })

  it('allows a @RequirePermission(key) route when the authorization service grants it', async () => {
    const authz = authzReturning(true)
    const guard = new PermissionGuard(reflector, authz)
    const ctx = contextFor(PermissionController.prototype.permissionedRoute, PermissionController, {
      userId: 'u1',
    })

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    expect(authz.can).toHaveBeenCalledWith('u1', 'event.read')
  })

  it('denies a @RequirePermission(key) route when the authorization service denies it', async () => {
    const authz = authzReturning(false)
    const guard = new PermissionGuard(reflector, authz)
    const ctx = contextFor(PermissionController.prototype.permissionedRoute, PermissionController, {
      userId: 'u1',
    })

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('denies a @RequirePermission(key) route when request.user is missing, without consulting the authorization service', async () => {
    const authz = authzReturning(true)
    const guard = new PermissionGuard(reflector, authz)
    const ctx = contextFor(PermissionController.prototype.permissionedRoute, PermissionController)

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException)
    expect(authz.can).not.toHaveBeenCalled()
  })

  it('denies a @RequirePermission(key) route when request.user has no userId, without consulting the authorization service', async () => {
    const authz = authzReturning(true)
    const guard = new PermissionGuard(reflector, authz)
    const ctx = contextFor(
      PermissionController.prototype.permissionedRoute,
      PermissionController,
      // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed user object
      {} as any,
    )

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException)
    expect(authz.can).not.toHaveBeenCalled()
  })

  it('honours a class-level @Public() marker on a method that carries none of its own', async () => {
    const authz = authzReturning(false)
    const guard = new PermissionGuard(reflector, authz)
    const ctx = contextFor(
      ClassLevelPublicController.prototype.inheritedRoute,
      ClassLevelPublicController,
    )

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    expect(authz.can).not.toHaveBeenCalled()
  })
})
