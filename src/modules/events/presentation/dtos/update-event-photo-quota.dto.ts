import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsOptional, Min } from 'class-validator'

export class UpdateEventPhotoQuotaDto {
  @ApiProperty({ example: 2000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  quota: number | null
}
