import { SetMetadata } from '@nestjs/common'

export const CONFIRM_PASSWORD_KEY = 'confirm_password'

export const ConfirmPassword = () => SetMetadata(CONFIRM_PASSWORD_KEY, true)
