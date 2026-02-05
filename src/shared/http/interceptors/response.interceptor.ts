import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { I18nContext } from 'nestjs-i18n'
import type { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { SUCCESS_MESSAGE_KEY } from '../decorators/success-message.decorator.js'
import type { ApiSuccessResponse } from '../interfaces/api-response.interface.js'

/**
 * Global interceptor that wraps all successful responses
 * in the ADR-002 envelope: `{ data, meta }`.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>()
    const i18n = I18nContext.current()

    const successMessageKey = this.reflector.get<string>(SUCCESS_MESSAGE_KEY, context.getHandler())

    const translatedMessage =
      successMessageKey && i18n ? String(i18n.t(successMessageKey)) : (successMessageKey ?? null)

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
          message: translatedMessage,
        },
      })),
    )
  }
}
