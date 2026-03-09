import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator'
import { ColorInputDto } from '../create-cyclist/create-cyclist.dto'

export class UpdateCyclistDto {
  @ApiPropertyOptional({
    description: 'Updated plate number (1-9999), or null to remove',
    example: 42,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  plateNumber?: number | null

  @ApiPropertyOptional({
    description: 'Updated equipment colors (replaces all existing colors)',
    type: [ColorInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColorInputDto)
  colors?: ColorInputDto[]
}
