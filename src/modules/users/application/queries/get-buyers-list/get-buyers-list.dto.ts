import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { IsOptional, IsString } from 'class-validator'

export class GetBuyersListDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, email, or phone number' })
  @IsString()
  @IsOptional()
  search?: string
}
