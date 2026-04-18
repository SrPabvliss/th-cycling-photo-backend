import { applyDecorators, type Type } from '@nestjs/common'
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger'
import { ApiErrorResponse, ApiMeta } from '../dto/api-response.dto'

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
    ApiExtraModels(options.type, ApiMeta),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: {
        type: 'object',
        properties: {
          data: dataSchema,
          meta: { $ref: getSchemaPath(ApiMeta) },
        },
        required: ['data', 'meta'],
      },
    }),
  )
}

/** Documents an error response in the ADR-002 envelope `{ error, meta }`. */
export const ApiEnvelopeErrorResponse = (options: { status: number; description: string }) => {
  return applyDecorators(
    ApiExtraModels(ApiErrorResponse),
    ApiResponse({
      status: options.status,
      description: options.description,
      schema: { $ref: getSchemaPath(ApiErrorResponse) },
    }),
  )
}
