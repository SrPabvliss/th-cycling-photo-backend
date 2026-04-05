import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator'

export class GetPhotosListDto {
  @ApiPropertyOptional({ description: 'Page number (defaults to 1)', example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number

  @ApiPropertyOptional({ description: 'Items per page (defaults to 20, max 100)', example: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number

  @ApiPropertyOptional({
    description: 'Filter by classification status: true=classified, false=unclassified',
  })
  @Transform(({ obj, key }) => {
    const raw = obj[key]
    if (raw === 'true' || raw === true) return true
    if (raw === 'false' || raw === false) return false
    return undefined
  })
  @IsBoolean()
  @IsOptional()
  classified?: boolean

  @ApiPropertyOptional({ description: 'Filter by photo category ID', example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  photoCategoryId?: number
}
