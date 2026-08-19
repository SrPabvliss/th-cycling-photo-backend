import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { CreateTenantHandler } from './application/commands/create-tenant/create-tenant.handler'
import { UpdateTenantQuotaHandler } from './application/commands/update-tenant-quota/update-tenant-quota.handler'
import { GetTenantsListHandler } from './application/queries/get-tenants-list/get-tenants-list.handler'
import { TENANT_REPOSITORY } from './domain/ports/tenant-repository.port'
import { TenantsController } from './infrastructure/controllers/tenants.controller'
import { TenantRepository } from './infrastructure/repositories/tenant.repository'

const handlers = [CreateTenantHandler, UpdateTenantQuotaHandler, GetTenantsListHandler]

@Module({
  imports: [CqrsModule],
  controllers: [TenantsController],
  providers: [
    ...handlers,
    {
      provide: TENANT_REPOSITORY,
      useClass: TenantRepository,
    },
  ],
  exports: [TENANT_REPOSITORY],
})
export class TenantsModule {}
