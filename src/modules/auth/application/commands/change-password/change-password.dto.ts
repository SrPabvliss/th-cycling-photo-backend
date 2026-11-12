import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength } from 'class-validator'
import { IsAccountPassword } from '../../validators/is-account-password.validator'

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password', example: 'CurrentPass123!' })
  @IsString()
  @MaxLength(128)
  currentPassword: string

  @ApiProperty({
    description: 'New password: 8 to 128 characters with at least one letter and one number',
    example: 'SecurePass123!',
    minLength: 8,
    maxLength: 128,
  })
  @IsAccountPassword()
  newPassword: string
}
