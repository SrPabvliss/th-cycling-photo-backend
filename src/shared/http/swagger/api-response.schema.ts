import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/** Metadata included in every successful API response. */
export class ApiMetaSchema {
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
}

/** Metadata included in error responses. */
export class ApiErrorMetaSchema {
  @ApiProperty({
    description: 'Unique request identifier',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  requestId: string

  @ApiProperty({ description: 'ISO 8601 timestamp', example: '2026-02-04T12:00:00.000Z' })
  timestamp: string

  @ApiProperty({ description: 'Request path', example: '/api/v1/events' })
  path: string
}

/** Error detail in error responses. */
export class ApiErrorDetailSchema {
  @ApiProperty({
    description: 'Error code',
    example: 'NOT_FOUND',
    enum: ['VALIDATION_FAILED', 'NOT_FOUND', 'BUSINESS_RULE', 'EXTERNAL_SERVICE', 'INTERNAL'],
  })
  code: string

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
}

/** Standard error response envelope (ADR-002). */
export class ApiErrorResponseSchema {
  @ApiProperty({ type: ApiErrorDetailSchema })
  error: ApiErrorDetailSchema

  @ApiProperty({ type: ApiErrorMetaSchema })
  meta: ApiErrorMetaSchema
}
