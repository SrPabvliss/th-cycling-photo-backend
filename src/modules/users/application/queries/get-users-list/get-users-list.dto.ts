import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class GetUsersListDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Include inactive users in the list (defaults to false)',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeInactive?: boolean

  @ApiPropertyOptional({
    description: 'Filter users by role name (e.g. "operator", "admin")',
    example: 'operator',
  })
  @IsString()
  @IsOptional()
  role?: string

  @ApiPropertyOptional({
    description: 'Search by name or email',
    example: 'juan',
  })
  @IsString()
  @IsOptional()
  search?: string
}
