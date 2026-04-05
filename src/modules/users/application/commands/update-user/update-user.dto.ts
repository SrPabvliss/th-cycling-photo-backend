import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class UpdateUserDto {
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
}
