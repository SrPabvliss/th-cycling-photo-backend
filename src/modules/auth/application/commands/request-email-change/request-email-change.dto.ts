import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsString, MaxLength } from 'class-validator'

export class RequestEmailChangeDto {
  @ApiProperty({ description: 'New email address', example: 'new-address@example.com' })
  @IsEmail()
  @MaxLength(255)
  newEmail: string

  @ApiProperty({ description: 'Current password', example: 'CurrentPass123!' })
  @IsString()
  @MaxLength(128)
  currentPassword: string
}
