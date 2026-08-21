import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { UsersModule } from '@users/users.module'
import { ConfirmWatermarkUploadHandler } from './application/commands/confirm-watermark-upload/confirm-watermark-upload.handler'
import { CreatePayoutMethodHandler } from './application/commands/create-payout-method/create-payout-method.handler'
import { CreateTenantHandler } from './application/commands/create-tenant/create-tenant.handler'
import { DeletePayoutMethodHandler } from './application/commands/delete-payout-method/delete-payout-method.handler'
import { GenerateWatermarkPresignedUrlHandler } from './application/commands/generate-watermark-presigned-url/generate-watermark-presigned-url.handler'
import { UpdateMyTenantProfileHandler } from './application/commands/update-my-tenant-profile/update-my-tenant-profile.handler'
import { UpdatePayoutMethodHandler } from './application/commands/update-payout-method/update-payout-method.handler'
import { UpdateTenantPhotoQuotaDefaultHandler } from './application/commands/update-tenant-photo-quota-default/update-tenant-photo-quota-default.handler'
import { UpdateTenantQuotaHandler } from './application/commands/update-tenant-quota/update-tenant-quota.handler'
import { GetMyPayoutMethodsHandler } from './application/queries/get-my-payout-methods/get-my-payout-methods.handler'
import { GetMyTenantProfileHandler } from './application/queries/get-my-tenant-profile/get-my-tenant-profile.handler'
import { GetTenantsListHandler } from './application/queries/get-tenants-list/get-tenants-list.handler'
import { TENANT_PAYOUT_METHOD_REPOSITORY } from './domain/ports/tenant-payout-method-repository.port'
import { TENANT_PROFILE_REPOSITORY } from './domain/ports/tenant-profile-repository.port'
import { TENANT_REPOSITORY } from './domain/ports/tenant-repository.port'
import { TenantRepository } from './infrastructure/repositories/tenant.repository'
import { TenantPayoutMethodRepository } from './infrastructure/repositories/tenant-payout-method.repository'
import { TenantProfileRepository } from './infrastructure/repositories/tenant-profile.repository'
import { TenantProfileController } from './presentation/controllers/tenant-profile.controller'
import { TenantsController } from './presentation/controllers/tenants.controller'

const handlers = [
  CreateTenantHandler,
  UpdateTenantQuotaHandler,
  UpdateTenantPhotoQuotaDefaultHandler,
  GetTenantsListHandler,
  GetMyTenantProfileHandler,
  GetMyPayoutMethodsHandler,
  UpdateMyTenantProfileHandler,
  CreatePayoutMethodHandler,
  UpdatePayoutMethodHandler,
  DeletePayoutMethodHandler,
  GenerateWatermarkPresignedUrlHandler,
  ConfirmWatermarkUploadHandler,
]

@Module({
  imports: [CqrsModule, UsersModule],
  controllers: [TenantsController, TenantProfileController],
  providers: [
    ...handlers,
    {
      provide: TENANT_REPOSITORY,
      useClass: TenantRepository,
    },
    {
      provide: TENANT_PROFILE_REPOSITORY,
      useClass: TenantProfileRepository,
    },
    {
      provide: TENANT_PAYOUT_METHOD_REPOSITORY,
      useClass: TenantPayoutMethodRepository,
    },
  ],
  exports: [TENANT_REPOSITORY, TENANT_PROFILE_REPOSITORY, TENANT_PAYOUT_METHOD_REPOSITORY],
})
export class TenantsModule {}
