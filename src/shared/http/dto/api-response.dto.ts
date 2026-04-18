import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import type { ErrorCode } from '../../domain/exceptions/app.exception'

/** Pagination metadata for list responses. */
export class ApiPaginationMeta {
  @ApiProperty({ description: 'Current page (1-indexed)', example: 1 })
  page: number

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit: number

  @ApiProperty({ description: 'Total number of records', example: 87 })
  total: number

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  totalPages: number
}

/** Metadata included in every successful API response. */
export class ApiMeta {
  @ApiProperty({
    description: 'Unique request identifier',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  requestId: string

  @ApiProperty({ description: 'ISO 8601 timestamp', example: '2026-02-04T12:00:00.000Z' })
  timestamp: string

  @ApiPropertyOptional({
    description: 'Translated success message',
    example: 'Event created successfully',
  })
  message?: string | null

  @ApiPropertyOptional({
    description: 'Pagination metadata (present on list endpoints)',
    type: ApiPaginationMeta,
  })
  pagination?: ApiPaginationMeta
}

/** Envelope for successful responses. Generics aren't natively supported by Swagger reflection here, so we keep this as an interface/type. */
export interface ApiSuccessResponse<T = unknown> {
  data: T
  meta: ApiMeta
}

/** Metadata included in error responses. */
export class ApiErrorMeta extends ApiMeta {
  @ApiProperty({ description: 'Request path', example: '/api/v1/events' })
  path: string
}

/** Error detail in error responses. */
export class ApiErrorDetail {
  @ApiProperty({
    description: 'Error code',
    example: 'NOT_FOUND',
    enum: ['VALIDATION_FAILED', 'NOT_FOUND', 'BUSINESS_RULE', 'EXTERNAL_SERVICE', 'INTERNAL'],
  })
  code: ErrorCode | string

  @ApiProperty({ description: 'Human-readable error message', example: 'Event not found' })
  message: string

  @ApiProperty({
    description: 'Whether the frontend should propagate the error prominently',
    example: false,
  })
  shouldThrow: boolean

  @ApiPropertyOptional({
    description: 'Per-field validation errors',
    example: { name: ['name must be longer than or equal to 3 characters'] },
  })
  fields?: Record<string, string[]>

  @ApiPropertyOptional({
    description: 'Additional structured error details',
  })
  details?: unknown

  stack?: string
}

/** Standard error response envelope (ADR-002). */
export class ApiErrorResponse {
  @ApiProperty({ type: ApiErrorDetail })
  error: ApiErrorDetail

  @ApiProperty({ type: ApiErrorMeta })
  meta: ApiErrorMeta
}
