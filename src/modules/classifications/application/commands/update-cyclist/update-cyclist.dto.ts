import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator'
import { ColorInputDto } from '../create-cyclist/create-cyclist.dto'

export class UpdateParticipantDto {
  @ApiPropertyOptional({
    description: 'Updated identifier value, or null to remove',
    example: '42',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  identifier?: string | null

  @ApiPropertyOptional({
    description: 'Updated gear colors (replaces all existing colors)',
    type: [ColorInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColorInputDto)
  colors?: ColorInputDto[]
}
