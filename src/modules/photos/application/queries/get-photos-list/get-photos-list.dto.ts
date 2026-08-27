import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator'

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

  @ApiPropertyOptional({ description: 'Only photos with no category', example: true })
  @Transform(({ obj, key }) => {
    const raw = obj[key]
    if (raw === undefined) return undefined
    return raw === 'true' || raw === true
  })
  @IsBoolean()
  @IsOptional()
  uncategorized?: boolean

  @ApiPropertyOptional({
    description: 'Bib predicate',
    enum: ['none', 'any', 'doubtful', 'corrected'],
  })
  @IsIn(['none', 'any', 'doubtful', 'corrected'])
  @IsOptional()
  bib?: 'none' | 'any' | 'doubtful' | 'corrected'

  @ApiPropertyOptional({ description: 'Sale state', enum: ['sold', 'unsold'] })
  @IsIn(['sold', 'unsold'])
  @IsOptional()
  sale?: 'sold' | 'unsold'

  @ApiPropertyOptional({ description: 'Search by bib digits', example: '142' })
  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{1,10}$/, { message: 'plateNumber must be 1-10 digits' })
  plateNumber?: string

  @ApiPropertyOptional({
    description: 'Match mode for the bib search',
    enum: ['exact', 'starts', 'contains'],
  })
  @IsIn(['exact', 'starts', 'contains'])
  @IsOptional()
  bibMatch?: 'exact' | 'starts' | 'contains'

  @ApiPropertyOptional({
    description: 'Ordering',
    enum: ['recent', 'no_bib_first', 'bib_asc', 'filename'],
  })
  @IsIn(['recent', 'no_bib_first', 'bib_asc', 'filename'])
  @IsOptional()
  sort?: 'recent' | 'no_bib_first' | 'bib_asc' | 'filename'
}
