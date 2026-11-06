import { ApiProperty } from '@nestjs/swagger'
import { NormalizeEmail } from '@shared/http/decorators/normalize-email.decorator'
import { IsEmail, IsString, MaxLength } from 'class-validator'

export class RequestEmailChangeDto {
  @ApiProperty({ description: 'New email address', example: 'new-address@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(255)
  newEmail: string

  @ApiProperty({ description: 'Current password', example: 'CurrentPass123!' })
  @IsString()
  @MaxLength(128)
  currentPassword: string
}
