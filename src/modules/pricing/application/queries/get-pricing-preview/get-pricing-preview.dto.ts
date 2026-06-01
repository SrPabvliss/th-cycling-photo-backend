import { Type } from 'class-transformer'
import { IsInt, Min } from 'class-validator'

export class GetPricingPreviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  photoCount!: number
}
