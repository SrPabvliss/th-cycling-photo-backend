import { Type } from 'class-transformer'
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator'

class PricingTierDto {
  @IsInt()
  @Min(1)
  minQty!: number

  @IsOptional()
  @IsInt()
  @Min(1)
  maxQty!: number | null

  @IsNumber()
  @Min(0)
  pricePerPhoto!: number
}

export class SetEventPricingConfigDto {
  @IsString()
  @Length(3, 3)
  currency!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingTierDto)
  tiers!: PricingTierDto[]
}
