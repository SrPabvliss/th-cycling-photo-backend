import { ApiProperty } from '@nestjs/swagger'
import { NormalizeEmail } from '@shared/http/decorators/normalize-email.decorator'
import { IsEmail, MaxLength } from 'class-validator'

export class RequestPasswordResetDto {
  @ApiProperty({ description: 'Email address', example: 'customer@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(255)
  email: string
}
