import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, Matches } from 'class-validator'

export class AddPhotoBibDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[0-9]{1,6}$/)
  digits!: string

  @ApiPropertyOptional({ enum: ['read', 'abstained'] })
  @IsOptional()
  @IsIn(['read', 'abstained'])
  status?: 'read' | 'abstained'
}
