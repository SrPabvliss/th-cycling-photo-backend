import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { IsOptional, IsString, IsUUID } from 'class-validator'

export class GetOrdersListDto extends PaginationQueryDto {
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
