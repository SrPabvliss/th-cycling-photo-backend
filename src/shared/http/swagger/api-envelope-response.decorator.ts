import { applyDecorators, type Type } from '@nestjs/common'
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger'
import { ApiErrorResponseSchema, ApiMetaSchema } from './api-response.schema.js'

/** Documents a successful response wrapped in the ADR-002 envelope `{ data: T, meta }`. */
export const ApiEnvelopeResponse = <T extends Type>(options: {
  status: number
  description: string
  type: T
  isArray?: boolean
}) => {
  const dataSchema = options.isArray
    ? { type: 'array', items: { $ref: getSchemaPath(options.type) } }
    : { $ref: getSchemaPath(options.type) }

  return applyDecorators(
    ApiExtraModels(options.type, ApiMetaSchema),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: {
        type: 'object',
        properties: {
          data: dataSchema,
          meta: { $ref: getSchemaPath(ApiMetaSchema) },
        },
        required: ['data', 'meta'],
      },
    }),
  )
}

/** Documents an error response in the ADR-002 envelope `{ error, meta }`. */
export const ApiEnvelopeErrorResponse = (options: { status: number; description: string }) => {
  return applyDecorators(
    ApiExtraModels(ApiErrorResponseSchema),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: { $ref: getSchemaPath(ApiErrorResponseSchema) },
    }),
  )
}
