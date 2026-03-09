import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsHexColor,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

export class ColorInputDto {
  @ApiProperty({
    description: 'Equipment category',
    example: 'helmet',
    enum: ['helmet', 'clothing', 'bike'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['helmet', 'clothing', 'bike'])
  itemType: string

  @ApiProperty({ description: 'Color name from the predefined palette', example: 'Red' })
  @IsString()
  @IsNotEmpty()
  colorName: string

  @ApiProperty({ description: 'Color hex code', example: '#FF0000' })
  @IsHexColor()
  colorHex: string
}

export class CreateCyclistDto {
  @ApiPropertyOptional({ description: 'Plate number (1-9999)', example: 42 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  plateNumber?: number

  @ApiProperty({
    description: 'Equipment colors for this cyclist',
    type: [ColorInputDto],
    example: [{ itemType: 'helmet', colorName: 'Red', colorHex: '#FF0000' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColorInputDto)
  colors: ColorInputDto[]
}
