import { type ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * For routes that serve both anonymous visitors and signed-in users, such as the cart.
 *
 * A request without an `Authorization` header is anonymous and goes through. A request that
 * does carry one is claiming a session, so it is verified exactly as a protected route would
 * verify it (signature, expiry, and that the session is still the account's current one) and is
 * answered 401 when it does not hold. It is never quietly downgraded to anonymous: that made an
 * expired session look like an empty cart and sent the buyer's photos to a cart they could not see.
 *
 * Used on `@Public()` routes, where the global `JwtAuthGuard` steps aside. When the session
 * holds, `request.user` is set just as on a protected route.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { authorization } = context.switchToHttp().getRequest<{
      headers: { authorization?: unknown }
    }>().headers

    const claimsNoSession = typeof authorization !== 'string' || authorization.trim() === ''
    if (claimsNoSession) return true

    return this.verifySession(context)
  }

  /** The same passport flow a protected route runs; it throws the same 401 when it fails. */
  async verifySession(context: ExecutionContext): Promise<boolean> {
    return (await super.canActivate(context)) as boolean
  }
}
