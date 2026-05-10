import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional } from 'class-validator'

export class GetReviewQueueDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter only photos pending review (defaults to true)' })
  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = obj[key]
    if (raw === 'false' || raw === false) return false
    if (raw === 'true' || raw === true) return true
    return undefined
  })
  @IsBoolean()
  onlyPending?: boolean
}
