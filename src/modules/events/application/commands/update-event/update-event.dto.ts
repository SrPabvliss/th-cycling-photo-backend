import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDate, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator'

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
    description: 'Optional description of the event (null to clear)',
    example: 'Competencia de ciclismo de montaña en la ruta del volcán Cotopaxi',
    nullable: true,
  })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string | null

  @ApiPropertyOptional({
    description: 'Physical location or address of the event (null to clear)',
    example: 'Ambato, Ecuador',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  location?: string | null

  @ApiPropertyOptional({
    description: 'Province ID where the event takes place (null to clear)',
    example: 18,
    nullable: true,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  provinceId?: number | null

  @ApiPropertyOptional({
    description: 'Canton ID where the event takes place (null to clear, requires provinceId)',
    example: 1,
    nullable: true,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  cantonId?: number | null
}
