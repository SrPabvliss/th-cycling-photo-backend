import { randomUUID } from 'node:crypto'
import { Injectable, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

/**
 * Generates a unique request ID for each incoming request.
 * Reuses the `X-Request-Id` header if provided by the client,
 * otherwise generates a new UUID v4.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID()
    req.requestId = requestId
    res.setHeader('X-Request-Id', requestId)
    next()
  }
}
