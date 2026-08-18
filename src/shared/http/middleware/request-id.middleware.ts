import { randomUUID } from 'node:crypto'
import { Injectable, type NestMiddleware } from '@nestjs/common'
import { authorizationStore } from '@shared/authorization/infrastructure/cache/request-scoped-authorization.cache'
import type { NextFunction, Request, Response } from 'express'

/**
 * Generates a unique request ID for each incoming request.
 * Reuses the `X-Request-Id` header if provided by the client,
 * otherwise generates a new UUID v4.
 *
 * Also opens the per-request authorization cache scope (see
 * `RequestScopedAuthorizationCache`) so downstream handlers share one
 * memoisation map that is discarded when the request ends.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID()
    req.requestId = requestId
    res.setHeader('X-Request-Id', requestId)
    authorizationStore.run(new Map(), () => next())
  }
}
