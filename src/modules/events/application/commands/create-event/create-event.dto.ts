import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDate, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateEventDto {
  @ApiProperty({ description: 'Name of the cycling event', example: 'Vuelta al Cotopaxi 2026' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name: string

  @ApiProperty({
    description: 'Date when the event takes place',
    example: '2026-06-15T08:00:00.000Z',
  })
  @IsDate()
  @Type(() => Date)
  date: Date

  @ApiPropertyOptional({
    description: 'Physical location or address of the event',
    example: 'Ambato, Ecuador',
  })
  @IsString()
  @IsOptional()
  location?: string
}
