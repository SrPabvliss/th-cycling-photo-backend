import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

export class RegisterDto {
  @ApiProperty({ description: 'Email address', example: 'customer@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string

  @ApiProperty({ description: 'Password (min 8 characters)', example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string

  @ApiProperty({ description: 'First name', example: 'Juan' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string

  @ApiProperty({ description: 'Last name', example: 'Perez' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string

  @ApiProperty({ description: 'Phone number with country code', example: '+593991234567' })
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @Matches(/^\+/, { message: 'phoneNumber must start with +' })
  phoneNumber: string

  @ApiProperty({ description: 'Country ID', example: 1 })
  @IsInt()
  @Min(1)
  countryId: number

  @ApiPropertyOptional({ description: 'Province ID', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  provinceId?: number

  @ApiPropertyOptional({ description: 'Canton ID', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  cantonId?: number
}
