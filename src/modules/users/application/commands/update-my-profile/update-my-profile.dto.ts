import { Gender } from '@generated/prisma/client'
import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator'

export class UpdateMyProfileDto {
  @ApiPropertyOptional({ description: 'First name', example: 'Pablo' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string

  @ApiPropertyOptional({ description: 'Last name', example: 'Villacres' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string

  @ApiPropertyOptional({ description: 'Country id', example: 63 })
  @IsInt()
  @IsPositive()
  @ValidateIf((dto) => dto.countryId !== undefined)
  countryId?: number

  @ApiPropertyOptional({ description: 'Province id', example: 18, nullable: true })
  @IsInt()
  @IsPositive()
  @IsOptional()
  provinceId?: number | null

  @ApiPropertyOptional({ description: 'Canton id', example: 180150, nullable: true })
  @IsInt()
  @IsPositive()
  @IsOptional()
  cantonId?: number | null

  @ApiPropertyOptional({ description: 'Birth date (ISO)', example: '1995-04-12', nullable: true })
  @IsDateString()
  @IsOptional()
  birthDate?: string | null

  @ApiPropertyOptional({ description: 'Gender', enum: Gender, nullable: true })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender | null
}
