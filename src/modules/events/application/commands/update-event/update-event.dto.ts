import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDate, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class UpdateEventDto {
  @ApiPropertyOptional({
    description: 'Name of the cycling event',
    example: 'Vuelta al Cotopaxi 2026',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @IsOptional()
  name?: string

  @ApiPropertyOptional({
    description: 'Date when the event takes place',
    example: '2026-06-15T08:00:00.000Z',
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  date?: Date

  @ApiPropertyOptional({
    description: 'Physical location or address of the event (null to clear)',
    example: 'Ambato, Ecuador',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  location?: string | null
}
