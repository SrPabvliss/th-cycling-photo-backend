import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { UsersModule } from '@users/users.module'
import { ConfirmWatermarkUploadHandler } from './application/commands/confirm-watermark-upload/confirm-watermark-upload.handler'
import { CreatePayoutMethodHandler } from './application/commands/create-payout-method/create-payout-method.handler'
import { DeletePayoutMethodHandler } from './application/commands/delete-payout-method/delete-payout-method.handler'
import { GenerateWatermarkPresignedUrlHandler } from './application/commands/generate-watermark-presigned-url/generate-watermark-presigned-url.handler'
import { UpdateMyTenantProfileHandler } from './application/commands/update-my-tenant-profile/update-my-tenant-profile.handler'
import { UpdatePayoutMethodHandler } from './application/commands/update-payout-method/update-payout-method.handler'
import { UpdateTenantPhotoQuotaDefaultHandler } from './application/commands/update-tenant-photo-quota-default/update-tenant-photo-quota-default.handler'
import { GetMyPayoutMethodsHandler } from './application/queries/get-my-payout-methods/get-my-payout-methods.handler'
import { GetMyTenantProfileHandler } from './application/queries/get-my-tenant-profile/get-my-tenant-profile.handler'
import { GetOrganizerDetailHandler } from './application/queries/get-organizer-detail/get-organizer-detail.handler'
import { GetOrganizerEventsHandler } from './application/queries/get-organizer-events/get-organizer-events.handler'
import { GetOrganizersListHandler } from './application/queries/get-organizers-list/get-organizers-list.handler'
import { GetOrganizersStatsHandler } from './application/queries/get-organizers-stats/get-organizers-stats.handler'
import { ORGANIZER_READ_REPOSITORY } from './domain/ports/organizer-read-repository.port'
import { TENANT_PAYOUT_METHOD_REPOSITORY } from './domain/ports/tenant-payout-method-repository.port'
import { TENANT_PROFILE_REPOSITORY } from './domain/ports/tenant-profile-repository.port'
import { TENANT_REPOSITORY } from './domain/ports/tenant-repository.port'
import { OrganizerReadRepository } from './infrastructure/repositories/organizer-read.repository'
import { TenantRepository } from './infrastructure/repositories/tenant.repository'
import { TenantPayoutMethodRepository } from './infrastructure/repositories/tenant-payout-method.repository'
import { TenantProfileRepository } from './infrastructure/repositories/tenant-profile.repository'
import { OrganizersController } from './presentation/controllers/organizers.controller'
import { TenantProfileController } from './presentation/controllers/tenant-profile.controller'
import { TenantsController } from './presentation/controllers/tenants.controller'

const handlers = [
  UpdateTenantPhotoQuotaDefaultHandler,
  GetMyTenantProfileHandler,
  GetMyPayoutMethodsHandler,
  UpdateMyTenantProfileHandler,
  CreatePayoutMethodHandler,
  UpdatePayoutMethodHandler,
  DeletePayoutMethodHandler,
  GenerateWatermarkPresignedUrlHandler,
  ConfirmWatermarkUploadHandler,
  GetOrganizersListHandler,
  GetOrganizersStatsHandler,
  GetOrganizerDetailHandler,
  GetOrganizerEventsHandler,
]

@Module({
  imports: [CqrsModule, UsersModule],
  controllers: [TenantsController, TenantProfileController, OrganizersController],
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
    {
      provide: ORGANIZER_READ_REPOSITORY,
      useClass: OrganizerReadRepository,
    },
  ],
  exports: [TENANT_REPOSITORY, TENANT_PROFILE_REPOSITORY, TENANT_PAYOUT_METHOD_REPOSITORY],
})
export class TenantsModule {}
