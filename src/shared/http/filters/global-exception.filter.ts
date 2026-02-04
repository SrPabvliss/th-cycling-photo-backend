import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { I18nContext } from 'nestjs-i18n'
import { AppException } from '../../domain/exceptions/app.exception.js'
import type { ApiErrorResponse } from '../interfaces/api-response.interface.js'

/**
 * Global exception filter that catches all exceptions and formats
 * them according to ADR-002 error response envelope.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<Request>()
    const response = ctx.getResponse<Response>()
    const i18n = I18nContext.current(host)

    const isDevelopment = process.env.NODE_ENV === 'development'
    const { status, body } = this.buildResponse(exception, request, isDevelopment, i18n)

    this.logger.error(
      `${request.method} ${request.url} - ${status}`,
      exception instanceof Error ? exception.stack : undefined,
    )

    response.status(status).json(body)
  }

  private buildResponse(
    exception: unknown,
    request: Request,
    isDevelopment: boolean,
    i18n: I18nContext | undefined,
  ): { status: number; body: ApiErrorResponse } {
    const meta = {
      requestId: (request as Record<string, unknown>)['requestId'] as string,
      timestamp: new Date().toISOString(),
      path: request.url,
    }

    if (exception instanceof AppException) {
      const translatedMessage = i18n
        ? i18n.t(exception.messageKey, { args: exception.context })
        : exception.messageKey

      return {
        status: exception.httpStatus,
        body: {
          error: {
            code: exception.code,
            message: translatedMessage,
            shouldThrow: exception.shouldThrow,
            ...(exception.fields && { fields: exception.fields }),
            ...(isDevelopment && {
              details: exception.context,
              stack: exception.stack,
            }),
          },
          meta,
        },
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const exceptionResponse = exception.getResponse()

      const fields = this.extractValidationFields(exceptionResponse)

      const errorCode = fields ? 'VALIDATION_FAILED' : 'INTERNAL'
      const messageKey = fields ? 'errors.VALIDATION_FAILED' : 'errors.INTERNAL'
      const translatedMessage = i18n ? i18n.t(messageKey) : messageKey

      return {
        status,
        body: {
          error: {
            code: errorCode,
            message: translatedMessage,
            shouldThrow: false,
            ...(fields && { fields }),
            ...(isDevelopment && {
              details: typeof exceptionResponse === 'object' ? exceptionResponse : undefined,
              stack: exception.stack,
            }),
          },
          meta,
        },
      }
    }

    const translatedMessage = i18n ? i18n.t('errors.INTERNAL') : 'An unexpected error occurred'

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL',
          message: translatedMessage,
          shouldThrow: false,
          ...(isDevelopment && {
            details: exception instanceof Error ? exception.message : exception,
            stack: exception instanceof Error ? exception.stack : undefined,
          }),
        },
        meta,
      },
    }
  }

  /**
   * Extracts per-field validation errors from class-validator BadRequestException.
   * class-validator returns { message: string[], error: 'Bad Request', statusCode: 400 }
   */
  private extractValidationFields(
    exceptionResponse: string | object,
  ): Record<string, string[]> | undefined {
    if (typeof exceptionResponse !== 'object' || exceptionResponse === null) {
      return undefined
    }

    const response = exceptionResponse as Record<string, unknown>
    const messages = response['message']

    if (!Array.isArray(messages)) {
      return undefined
    }

    const fields: Record<string, string[]> = {}
    for (const msg of messages) {
      if (typeof msg !== 'string') continue
      const parts = msg.split(' ')
      const fieldName = parts[0]
      if (fieldName) {
        if (!fields[fieldName]) {
          fields[fieldName] = []
        }
        fields[fieldName].push(msg)
      }
    }

    return Object.keys(fields).length > 0 ? fields : undefined
  }
}
