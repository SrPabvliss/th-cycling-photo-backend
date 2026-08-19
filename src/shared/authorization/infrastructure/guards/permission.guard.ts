import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '@shared/auth'
import type { PermissionKey } from '../../domain/permission-catalog'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '../../domain/ports/authorization.service.port'
import { IS_AUTHENTICATED_KEY } from '../../presentation/decorators/authenticated.decorator'
import { PERMISSION_KEY } from '../../presentation/decorators/require-permission.decorator'

/**
 * The coarse enforcement point: does this principal hold the required permission *anywhere*. Every
 * route must carry exactly one of `@Public()`, `@Authenticated()` or `@RequirePermission(key)`, and
 * a route with none is denied — an unclassified route must never be silently reachable.
 *
 * Per-event scoping is left to the handlers: routes are slug-based, so scoping here would force a
 * double fetch. Runs after `JwtAuthGuard`, which populates `request.user`.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()]

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true
    if (this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED_KEY, targets)) return true

    const key = this.reflector.getAllAndOverride<PermissionKey>(PERMISSION_KEY, targets)

    // Fail closed: an unclassified route is denied, never silently allowed.
    if (!key) throw new ForbiddenException('Route is not authorized')

    const { user } = context.switchToHttp().getRequest()
    if (!user?.userId) throw new ForbiddenException('Insufficient permissions')

    if (!(await this.authz.can(user.userId, key))) {
      throw new ForbiddenException('Insufficient permissions')
    }
    return true
  }
}
