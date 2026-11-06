import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import type { Request, Response } from 'express'
import { I18nContext } from 'nestjs-i18n'
import { AppException, ErrorCode } from '../../domain/exceptions/app.exception'
import type { ApiErrorResponse } from '../dto/api-response.dto'
import { agreeingMessageKey, translateEntity } from '../i18n/entity-agreement'

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
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    }

    if (exception instanceof AppException) {
      const translatedMessage = i18n
        ? this.translateAppException(i18n, exception)
        : exception.messageKey

      return {
        status: exception.httpStatus,
        body: {
          error: {
            code: exception.code,
            message: translatedMessage,
            messageKey: exception.messageKey,
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

    if (exception instanceof PrismaClientKnownRequestError) {
      const appException = this.mapPrismaError(exception)
      const translatedMessage = i18n
        ? String(i18n.t(appException.messageKey, { args: appException.context }))
        : appException.messageKey

      return {
        status: appException.httpStatus,
        body: {
          error: {
            code: appException.code,
            message: translatedMessage,
            messageKey: appException.messageKey,
            shouldThrow: false,
            ...(isDevelopment && {
              details: {
                prismaCode: exception.code,
                ...appException.context,
              },
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

      const { code: errorCode, messageKey } = fields
        ? { code: 'VALIDATION_FAILED', messageKey: 'errors.VALIDATION_FAILED' }
        : this.describeHttpStatus(status)
      const translatedMessage = i18n ? String(i18n.t(messageKey)) : messageKey

      return {
        status,
        body: {
          error: {
            code: errorCode,
            message: translatedMessage,
            messageKey,
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

    const translatedMessage = i18n
      ? String(i18n.t('errors.INTERNAL'))
      : 'An unexpected error occurred'

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

  private translateAppException(i18n: I18nContext, exception: AppException): string {
    const entity = exception.context?.entity
    if (typeof entity !== 'string') {
      return String(i18n.t(exception.messageKey, { args: exception.context }))
    }
    const key = agreeingMessageKey(i18n, exception.messageKey, entity)
    return String(
      i18n.t(key, { args: { ...exception.context, entity: translateEntity(i18n, entity) } }),
    )
  }

  /**
   * Maps PrismaClientKnownRequestError codes to AppException instances.
   */
  private mapPrismaError(error: PrismaClientKnownRequestError): AppException {
    switch (error.code) {
      case 'P2002': {
        const target = (error.meta?.target as string[]) ?? []
        return AppException.conflict('errors.CONFLICT', {
          fields: target.join(', '),
        })
      }
      case 'P2025':
        return new AppException(
          'errors.NOT_FOUND',
          HttpStatus.NOT_FOUND,
          ErrorCode.NOT_FOUND,
          false,
          { cause: error.meta?.cause },
        )
      case 'P2003': {
        const field = (error.meta?.field_name as string) ?? 'unknown'
        return new AppException(
          'errors.FOREIGN_KEY_FAILED',
          HttpStatus.UNPROCESSABLE_ENTITY,
          ErrorCode.BUSINESS_RULE,
          false,
          { field },
        )
      }
      case 'P2007':
      case 'P2023':
        return new AppException(
          'errors.INVALID_ID',
          HttpStatus.BAD_REQUEST,
          ErrorCode.VALIDATION_FAILED,
          false,
        )
      default:
        return AppException.internal('errors.INTERNAL', { prismaCode: error.code })
    }
  }

  private describeHttpStatus(status: number): { code: string; messageKey: string } {
    if (status === HttpStatus.UNAUTHORIZED) {
      return { code: 'UNAUTHORIZED', messageKey: 'errors.UNAUTHORIZED' }
    }
    if (status === HttpStatus.FORBIDDEN) {
      return { code: ErrorCode.FORBIDDEN, messageKey: 'errors.FORBIDDEN' }
    }
    if (status === HttpStatus.NOT_FOUND) {
      return { code: ErrorCode.NOT_FOUND, messageKey: 'errors.RESOURCE_NOT_FOUND' }
    }
    if (status === HttpStatus.CONFLICT) {
      return { code: ErrorCode.CONFLICT, messageKey: 'errors.REQUEST_CONFLICT' }
    }
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return { code: 'TOO_MANY_REQUESTS', messageKey: 'errors.TOO_MANY_REQUESTS' }
    }
    if (status >= 400 && status < 500) {
      return { code: 'BAD_REQUEST', messageKey: 'errors.BAD_REQUEST' }
    }
    return { code: ErrorCode.INTERNAL, messageKey: 'errors.INTERNAL' }
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
    const messages = response.message

    if (!Array.isArray(messages)) {
      return undefined
    }

    const fields: Record<string, string[]> = {}
    for (const msg of messages) {
      if (typeof msg !== 'string') continue
      const parts = msg.split(' ')
      const fieldName = parts[0] === 'property' && parts[1] ? parts[1] : parts[0]
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
