import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password', example: 'CurrentPass123!' })
  @IsString()
  @MaxLength(128)
  currentPassword: string

  @ApiProperty({ description: 'Password (min 8 characters)', example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string
}
