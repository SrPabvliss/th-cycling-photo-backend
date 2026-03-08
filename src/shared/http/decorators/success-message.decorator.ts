import { SetMetadata } from '@nestjs/common'

export const SUCCESS_MESSAGE_KEY = 'successMessage'

export interface SuccessMessageMetadata {
  key: string
  args?: Record<string, string>
}

/**
 * Sets a translatable success message key on a controller method.
 * The ResponseInterceptor reads this metadata to include a
 * translated message in the response envelope.
 *
 * @example
 * ```typescript
 * @Post()
 * @SuccessMessage('success.CREATED', { entity: 'entities.event' })
 * async create(@Body() dto: CreateEventDto) { ... }
 * ```
 */
export const SuccessMessage = (messageKey: string, args?: Record<string, string>) =>
  SetMetadata(SUCCESS_MESSAGE_KEY, { key: messageKey, args } satisfies SuccessMessageMetadata)
