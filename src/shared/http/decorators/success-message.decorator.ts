import { SetMetadata } from '@nestjs/common'

export const SUCCESS_MESSAGE_KEY = 'successMessage'

/**
 * Sets a translatable success message key on a controller method.
 * The ResponseInterceptor reads this metadata to include a
 * translated message in the response envelope.
 *
 * @example
 * ```typescript
 * @Post()
 * @SuccessMessage('success.CREATED')
 * async create(@Body() dto: CreateEventDto) { ... }
 * ```
 */
export const SuccessMessage = (messageKey: string) => SetMetadata(SUCCESS_MESSAGE_KEY, messageKey)
