import { Gender } from '@generated/prisma/client'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
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

  @ApiPropertyOptional({ description: 'Birth date (YYYY-MM-DD)', example: '1995-04-23' })
  @IsOptional()
  @IsDateString()
  birthDate?: string

  @ApiPropertyOptional({ enum: Gender, description: 'Gender', example: 'female' })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender

  @ApiPropertyOptional({
    description: 'Acceptance of the privacy policy and terms of service. Must be true when sent',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Equals(true)
  acceptedTerms?: boolean

  @ApiPropertyOptional({
    description:
      'Confirmation that a legal guardian is registering on behalf of a minor. Must be true when sent',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Equals(true)
  guardianConsent?: boolean
}
