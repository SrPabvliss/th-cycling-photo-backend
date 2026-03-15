import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'
import { ColorInputDto } from '../create-cyclist/create-cyclist.dto'

export class BulkClassifyDto {
  @ApiProperty({
    description: 'Array of photo UUIDs to classify',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  photoIds: string[]

  @ApiPropertyOptional({ description: 'Plate number (1-9999)', example: 42 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  plateNumber?: number

  @ApiProperty({
    description: 'Equipment colors for the cyclist',
    type: [ColorInputDto],
    example: [{ itemType: 'helmet', colorName: 'Red', colorHex: '#FF0000' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColorInputDto)
  colors: ColorInputDto[]
}
