import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationQueryDto } from '@shared/application'
import { IsIn, IsOptional, IsString } from 'class-validator'
import {
  ORGANIZER_SORTS,
  ORGANIZER_TABS,
  type OrganizerSort,
  type OrganizerTab,
} from '../../domain/ports/organizer-read-repository.port'

export class GetOrganizersListDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by commercial name or holder email' })
  @IsString()
  @IsOptional()
  search?: string

  @ApiPropertyOptional({ enum: ORGANIZER_TABS })
  @IsIn(ORGANIZER_TABS)
  @IsOptional()
  tab?: OrganizerTab

  @ApiPropertyOptional({ enum: ORGANIZER_SORTS })
  @IsIn(ORGANIZER_SORTS)
  @IsOptional()
  sort?: OrganizerSort
}
