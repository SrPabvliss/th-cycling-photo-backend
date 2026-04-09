import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator'

const ALLOWED_ROLES = ['admin', 'operator'] as const

export class CreateUserDto {
  @ApiProperty({ description: 'First name', example: 'Pablo' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  firstName: string

  @ApiProperty({ description: 'Last name', example: 'Villacres' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  lastName: string

  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string

  @ApiProperty({ description: 'Role to assign', example: 'operator', enum: ALLOWED_ROLES })
  @IsString()
  @IsIn(ALLOWED_ROLES)
  role: string

  @ApiProperty({ description: 'Initial password', example: 'SecurePass123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password: string
}
