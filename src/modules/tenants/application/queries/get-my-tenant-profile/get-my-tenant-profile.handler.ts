import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { AppException } from '@shared/domain'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import {
  type ITenantProfileRepository,
  TENANT_PROFILE_REPOSITORY,
} from '../../../domain/ports/tenant-profile-repository.port'
import type { TenantProfileProjection } from '../../projections/tenant-profile.projection'
import { GetMyTenantProfileQuery } from './get-my-tenant-profile.query'

@QueryHandler(GetMyTenantProfileQuery)
export class GetMyTenantProfileHandler implements IQueryHandler<GetMyTenantProfileQuery> {
  constructor(
    @Inject(TENANT_PROFILE_REPOSITORY) private readonly repo: ITenantProfileRepository,
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  async execute(query: GetMyTenantProfileQuery): Promise<TenantProfileProjection> {
    const tenantId = await this.userRepo.findTenantId(query.actorUserId)
    if (!tenantId) throw AppException.forbidden('tenant.not_a_tenant_member')

    const profile = await this.repo.findByTenantId(tenantId)
    if (!profile) throw AppException.notFound('entities.tenant', tenantId)

    return {
      id: profile.id,
      name: profile.name,
      publicName: profile.publicName,
      watermarkStorageKey: profile.watermarkStorageKey,
      watermarkUrl: profile.watermarkStorageKey
        ? this.cdn.watermarkUrl(profile.id, profile.watermarkStorageKey)
        : null,
      whatsappNumber: profile.whatsappNumber,
      whatsappPendingVerification:
        profile.whatsappNumber !== null && profile.whatsappVerifiedAt === null,
    }
  }
}
