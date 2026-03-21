import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class GetCustomersListDto {
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

  @ApiPropertyOptional({
    description: 'Search by name or WhatsApp number',
    example: 'Carlos',
  })
  @IsString()
  @IsOptional()
  search?: string
}
