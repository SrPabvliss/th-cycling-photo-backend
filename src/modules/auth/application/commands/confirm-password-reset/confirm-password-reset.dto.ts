import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'
import { IsAccountPassword } from '../../validators/is-account-password.validator'

export class ConfirmPasswordResetDto {
  @ApiProperty({ description: 'Reset token from the email link fragment' })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token: string

  @ApiProperty({
    description: 'New password: 8 to 128 characters with at least one letter and one number',
    example: 'SecurePass123!',
    minLength: 8,
    maxLength: 128,
  })
  @IsAccountPassword()
  password: string
}
