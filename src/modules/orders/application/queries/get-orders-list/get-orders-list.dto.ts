import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'

export class GetOrdersListDto {
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

  @ApiPropertyOptional({ description: 'Filter by event ID' })
  @IsUUID('4')
  @IsOptional()
  eventId?: string

  @ApiPropertyOptional({ description: 'Filter by status', example: 'pending' })
  @IsString()
  @IsOptional()
  status?: string

  @ApiPropertyOptional({ description: 'Search by customer name or WhatsApp', example: 'Carlos' })
  @IsString()
  @IsOptional()
  search?: string
}
