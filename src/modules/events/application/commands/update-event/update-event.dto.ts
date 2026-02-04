import { Type } from 'class-transformer'
import { IsDate, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class UpdateEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @IsOptional()
  name?: string

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  date?: Date

  @IsString()
  @IsOptional()
  location?: string | null
}
