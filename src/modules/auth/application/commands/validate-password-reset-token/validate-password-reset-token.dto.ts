import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

export class ValidatePasswordResetTokenDto {
  @ApiProperty({ description: 'Reset token from the email link fragment' })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  token: string
}
