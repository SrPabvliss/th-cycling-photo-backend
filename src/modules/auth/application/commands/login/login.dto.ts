import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class LoginDto {
  @ApiProperty({ description: 'Email address', example: 'admin@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string

  @ApiProperty({ description: 'Password', example: 'SecurePass123!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string
}
