import { EventConfigurationService } from '@events/application/services/event-configuration.service'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { AppException } from '@shared/domain'
import { PayoutMethodProjection } from '@tenants/application/projections/payout-method.projection'
import {
  type ITenantPayoutMethodRepository,
  TENANT_PAYOUT_METHOD_REPOSITORY,
} from '@tenants/domain/ports/tenant-payout-method-repository.port'
import {
  type ITenantProfileRepository,
  TENANT_PROFILE_REPOSITORY,
} from '@tenants/domain/ports/tenant-profile-repository.port'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import { EventConfigurationPresetProjection } from '../../projections/event-configuration.projection'
import { GetEventConfigurationPresetQuery } from './get-event-configuration-preset.query'

@QueryHandler(GetEventConfigurationPresetQuery)
export class GetEventConfigurationPresetHandler
  implements IQueryHandler<GetEventConfigurationPresetQuery>
{
  constructor(
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
    @Inject(TENANT_PROFILE_REPOSITORY) private readonly profileRepo: ITenantProfileRepository,
    @Inject(TENANT_PAYOUT_METHOD_REPOSITORY)
    private readonly payoutRepo: ITenantPayoutMethodRepository,
    private readonly configService: EventConfigurationService,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  async execute(
    query: GetEventConfigurationPresetQuery,
  ): Promise<EventConfigurationPresetProjection> {
    const tenantId = await this.userRepo.findTenantId(query.actorUserId)
    if (!tenantId) {
      throw AppException.businessRule('event.creator_tenant_required')
    }

    const [profile, methods, missing] = await Promise.all([
      this.profileRepo.findByTenantId(tenantId),
      this.payoutRepo.findByTenantId(tenantId),
      this.configService.findMissingRequirements(tenantId),
    ])

    const availablePayoutMethods: PayoutMethodProjection[] = methods
      .filter((method) => method.isActive)
      .map((method) => ({
        id: method.id,
        provider: method.provider,
        isActive: method.isActive,
        sortOrder: method.sortOrder,
        status: method.status,
        receiverIdentifier: method.receiverIdentifier,
        bankName: method.bankName,
        accountNumber: method.accountNumber,
        accountType: method.accountType,
        accountHolder: method.accountHolder,
        holderIdentification: method.holderIdentification,
        verifiedAt: method.verifiedAt,
      }))

    return {
      publicName: profile?.publicName ?? null,
      watermarkStorageKey: profile?.watermarkStorageKey ?? null,
      watermarkUrl: profile?.watermarkStorageKey
        ? this.cdn.watermarkUrl(profile.id, profile.watermarkStorageKey)
        : null,
      whatsappNumber: profile?.whatsappNumber ?? null,
      whatsappPendingVerification:
        profile !== null && profile.whatsappNumber !== null && profile.whatsappVerifiedAt === null,
      availablePayoutMethods,
      missing,
    }
  }
}
