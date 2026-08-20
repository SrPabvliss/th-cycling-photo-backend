import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  type ITenantRepository,
  TENANT_REPOSITORY,
  type TenantListProjection,
} from '../../../domain/ports/tenant-repository.port'
import { GetTenantsListQuery } from './get-tenants-list.query'

@QueryHandler(GetTenantsListQuery)
export class GetTenantsListHandler implements IQueryHandler<GetTenantsListQuery> {
  constructor(@Inject(TENANT_REPOSITORY) private readonly repo: ITenantRepository) {}

  async execute(): Promise<TenantListProjection[]> {
    return this.repo.getTenantsList()
  }
}
