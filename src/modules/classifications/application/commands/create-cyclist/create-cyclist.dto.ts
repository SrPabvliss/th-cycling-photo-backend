import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsHexColor,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

export class ColorInputDto {
  @ApiProperty({
    description: 'Gear type ID (FK to gear_types table)',
    example: 1,
  })
  @IsInt()
  gearTypeId: number

  @ApiProperty({ description: 'Color name from the predefined palette', example: 'Red' })
  @IsString()
  @IsNotEmpty()
  colorName: string

  @ApiProperty({ description: 'Color hex code', example: '#FF0000' })
  @IsHexColor()
  colorHex: string
}

export class CreateParticipantDto {
  @ApiPropertyOptional({ description: 'Participant identifier value', example: '42' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  identifier?: string

  @ApiProperty({
    description: 'Gear colors for this participant',
    type: [ColorInputDto],
    example: [{ gearTypeId: 1, colorName: 'Red', colorHex: '#FF0000' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColorInputDto)
  colors: ColorInputDto[]
}
