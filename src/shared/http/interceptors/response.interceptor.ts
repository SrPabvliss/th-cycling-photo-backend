import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PaginatedResult } from '@shared/application'
import type { Request } from 'express'
import { I18nContext } from 'nestjs-i18n'
import type { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import {
  SUCCESS_MESSAGE_KEY,
  type SuccessMessageMetadata,
} from '../decorators/success-message.decorator'
import type { ApiSuccessResponse } from '../interfaces/api-response.interface'

/**
 * Global interceptor that wraps all successful responses
 * in the ADR-002 envelope: `{ data, meta }`.
 *
 * When a handler returns a `PaginatedResult`, the interceptor
 * unwraps it and adds `meta.pagination` automatically.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>()
    const i18n = I18nContext.current()

    const messageMeta = this.reflector.get<SuccessMessageMetadata>(
      SUCCESS_MESSAGE_KEY,
      context.getHandler(),
    )

    let translatedMessage: string | null = null
    if (messageMeta) {
      const resolvedArgs =
        messageMeta.args && i18n
          ? Object.fromEntries(
              Object.entries(messageMeta.args).map(([k, v]) => [k, String(i18n.t(v))]),
            )
          : messageMeta.args
      translatedMessage = i18n
        ? String(i18n.t(messageMeta.key, { args: resolvedArgs }))
        : messageMeta.key
    }

    return next.handle().pipe(
      map((data) => {
        const meta = {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
          message: translatedMessage,
        }

        if (data instanceof PaginatedResult) {
          return {
            data: data.items as T,
            meta: {
              ...meta,
              pagination: {
                page: data.pagination.page,
                limit: data.pagination.limit,
                total: data.total,
                totalPages: data.totalPages,
              },
            },
          }
        }

        return { data, meta }
      }),
    )
  }
}
