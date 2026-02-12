import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsHexColor,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'

export class PlateClassificationDto {
  @ApiProperty({ description: 'Plate number (1-999)', example: 42 })
  @IsInt()
  @Min(1)
  @Max(999)
  number: number

  @ApiPropertyOptional({ description: 'OCR confidence score', example: 0.95 })
  @IsNumber()
  @IsOptional()
  confidenceScore?: number
}

export class ColorClassificationDto {
  @ApiProperty({ description: 'Equipment item type', example: 'jersey' })
  @IsString()
  @IsIn(['helmet', 'jersey', 'bike'])
  itemType: string

  @ApiProperty({ description: 'Color name', example: 'red' })
  @IsString()
  @IsNotEmpty()
  colorName: string

  @ApiProperty({ description: 'Hex color code', example: '#FF0000' })
  @IsHexColor()
  colorHex: string

  @ApiProperty({ description: 'Color density percentage (0-100)', example: 65.5 })
  @IsNumber()
  @Min(0)
  @Max(100)
  densityPercentage: number
}

export class CyclistClassificationDto {
  @ApiProperty({
    description: 'Bounding box coordinates',
    example: { x: 100, y: 200, width: 50, height: 100 },
  })
  @IsObject()
  boundingBox: Record<string, number>

  @ApiProperty({ description: 'Detection confidence score', example: 0.92 })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceScore: number

  @ApiPropertyOptional({ type: PlateClassificationDto })
  @ValidateNested()
  @Type(() => PlateClassificationDto)
  @IsOptional()
  plateNumber?: PlateClassificationDto

  @ApiPropertyOptional({ type: [ColorClassificationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColorClassificationDto)
  @IsOptional()
  colors?: ColorClassificationDto[]
}

export class ClassifyPhotoDto {
  @ApiProperty({ type: [CyclistClassificationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CyclistClassificationDto)
  cyclists: CyclistClassificationDto[]
}
