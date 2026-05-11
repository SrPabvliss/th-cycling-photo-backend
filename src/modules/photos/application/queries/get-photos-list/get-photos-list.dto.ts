import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { Transform } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator'

export class GetPhotosListDto extends PaginationQueryDto {
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
