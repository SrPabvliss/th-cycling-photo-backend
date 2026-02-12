import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator'

export class GetPhotosListDto {
  @ApiProperty({ description: 'Event UUID to list photos for', format: 'uuid' })
  @IsUUID()
  eventId: string

  @ApiPropertyOptional({ description: 'Page number (defaults to 1)', example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number

  @ApiPropertyOptional({ description: 'Items per page (defaults to 20, max 100)', example: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number
}
