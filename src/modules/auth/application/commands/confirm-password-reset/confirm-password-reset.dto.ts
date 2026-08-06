import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

export class ConfirmPasswordResetDto {
  @ApiProperty({ description: 'Reset token from the email link fragment' })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token: string

  @ApiProperty({ description: 'New password (min 8 characters)', example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string
}
