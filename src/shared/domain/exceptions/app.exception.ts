import { HttpStatus } from '@nestjs/common'

export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  BUSINESS_RULE = 'BUSINESS_RULE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  INTERNAL = 'INTERNAL',
}

/**
 * Application-wide exception class with factory methods.
 * All domain and application errors should use this class
 * instead of native Error or NestJS exceptions.
 */
export class AppException extends Error {
  public readonly fields?: Record<string, string[]>

  constructor(
    public readonly messageKey: string,
    public readonly httpStatus: HttpStatus,
    public readonly code: ErrorCode = ErrorCode.INTERNAL,
    public readonly shouldThrow: boolean = false,
    public readonly context?: Record<string, unknown>,
  ) {
    super(messageKey)
  }

  /** Resource not found (404) */
  static notFound(entity: string, id: string): AppException {
    return new AppException('errors.NOT_FOUND', HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, false, {
      entity,
      id,
    })
  }

  /** Validation failed with per-field errors (400) */
  static validationFailed(fields: Record<string, string[]>): AppException {
    const exception = new AppException(
      'errors.VALIDATION_FAILED',
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_FAILED,
      false,
    )
    ;(exception as { fields: Record<string, string[]> }).fields = fields
    return exception
  }

  /** Business rule violation (422) */
  static businessRule(messageKey: string, shouldThrow = false): AppException {
    return new AppException(
      messageKey,
      HttpStatus.UNPROCESSABLE_ENTITY,
      ErrorCode.BUSINESS_RULE,
      shouldThrow,
    )
  }

  /** External service failure (502) */
  static externalService(service: string, originalError?: Error): AppException {
    return new AppException(
      'errors.EXTERNAL_SERVICE',
      HttpStatus.BAD_GATEWAY,
      ErrorCode.EXTERNAL_SERVICE,
      false,
      { service, originalError: originalError?.message },
    )
  }

  /** Unexpected internal error (500) */
  static internal(message: string, context?: Record<string, unknown>): AppException {
    return new AppException(
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
      ErrorCode.INTERNAL,
      false,
      context,
    )
  }
}
