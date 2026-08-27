import { Gender } from '@generated/prisma/client'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString } from 'class-validator'

export const BUYER_PURCHASE_FILTERS = ['all', 'bought', 'never', 'recurrent'] as const
export type BuyerPurchaseFilter = (typeof BUYER_PURCHASE_FILTERS)[number]

export const BUYER_SORTS = ['recent', 'spent', 'orders', 'last_purchase'] as const
export type BuyerSort = (typeof BUYER_SORTS)[number]

export class GetBuyersListDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, email, or phone number' })
  @IsString()
  @IsOptional()
  search?: string

  @ApiPropertyOptional({
    description: 'Restrict the list to one of the four purchase tabs (defaults to "all")',
    enum: BUYER_PURCHASE_FILTERS,
  })
  @IsIn(BUYER_PURCHASE_FILTERS)
  @IsOptional()
  purchase?: BuyerPurchaseFilter

  @ApiPropertyOptional({ description: 'Filter by country id (customer profile)' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  countryId?: number

  @ApiPropertyOptional({ description: 'Filter by province id (customer profile)' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  provinceId?: number

  @ApiPropertyOptional({ description: 'Registered on or after this date (ISO)' })
  @IsDateString()
  @IsOptional()
  registeredFrom?: string

  @ApiPropertyOptional({ description: 'Registered on or before this date (ISO)' })
  @IsDateString()
  @IsOptional()
  registeredTo?: string

  @ApiPropertyOptional({ description: 'Filter by gender (customer profile)', enum: Gender })
  @IsIn(Object.values(Gender))
  @IsOptional()
  gender?: Gender

  @ApiPropertyOptional({ description: 'Minimum age, derived from birth date' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  ageFrom?: number

  @ApiPropertyOptional({ description: 'Maximum age, derived from birth date' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  ageTo?: number

  @ApiPropertyOptional({ description: 'Filter by whether the email is verified' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  emailVerified?: boolean

  @ApiPropertyOptional({ description: 'Filter by whether the buyer has a WhatsApp phone' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  hasWhatsapp?: boolean

  @ApiPropertyOptional({
    description: 'Sort order (defaults to "recent")',
    enum: BUYER_SORTS,
  })
  @IsIn(BUYER_SORTS)
  @IsOptional()
  sort?: BuyerSort
}
