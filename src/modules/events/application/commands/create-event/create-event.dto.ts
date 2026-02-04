import { Type } from 'class-transformer'
import { IsDate, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name: string

  @IsDate()
  @Type(() => Date)
  date: Date

  @IsString()
  @IsOptional()
  location?: string
}
