import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
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

  @ApiPropertyOptional({ description: 'Participant identifier value', example: '42' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  identifier?: string

  @ApiProperty({
    description: 'Gear colors for the participant',
    type: [ColorInputDto],
    example: [{ gearTypeId: 1, colorName: 'Red', colorHex: '#FF0000' }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColorInputDto)
  colors: ColorInputDto[]
}
