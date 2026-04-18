import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator'

export class CheckoutCartItemDto {
  @ApiProperty({ description: 'Event ID' })
  @IsUUID('4')
  eventId: string

  @ApiPropertyOptional({ description: 'Bib number visible in the photos' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  bibNumber?: string

  @ApiPropertyOptional({ description: 'Category name snapshot for the order' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  snapCategoryName?: string
}

export class CheckoutCartDto {
  @ApiProperty({ description: 'Checkout items per event', type: [CheckoutCartItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutCartItemDto)
  items: CheckoutCartItemDto[]
}
