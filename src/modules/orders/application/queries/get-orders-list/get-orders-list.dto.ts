import { ApiPropertyOptional } from '@nestjs/swagger'
import { OrderStatus, type OrderStatusType } from '@orders/domain/value-objects/order-status.vo'
import { PaginationQueryDto } from '@shared/application'
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator'

export class GetOrdersListDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by event ID' })
  @IsUUID('4')
  @IsOptional()
  eventId?: string

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: Object.values(OrderStatus),
    example: 'pending',
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatusType

  @ApiPropertyOptional({ description: 'Search by customer name or WhatsApp', example: 'Carlos' })
  @IsString()
  @IsOptional()
  search?: string
}
