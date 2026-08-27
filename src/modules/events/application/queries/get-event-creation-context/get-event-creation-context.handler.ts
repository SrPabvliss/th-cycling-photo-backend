import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import {
  CONTRACT_REPOSITORY,
  type IContractRepository,
} from '../../../../contracts/domain/ports/contract-repository.port'
import {
  type ITenantRepository,
  TENANT_REPOSITORY,
} from '../../../../tenants/domain/ports/tenant-repository.port'
import { EventCreationContextProjection } from '../../projections/event-creation-context.projection'
import { GetEventCreationContextQuery } from './get-event-creation-context.query'

@QueryHandler(GetEventCreationContextQuery)
export class GetEventCreationContextHandler implements IQueryHandler<GetEventCreationContextQuery> {
  constructor(
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: ITenantRepository,
    @Inject(CONTRACT_REPOSITORY) private readonly contractRepo: IContractRepository,
  ) {}

  async execute(query: GetEventCreationContextQuery): Promise<EventCreationContextProjection> {
    const tenantId = await this.userRepo.findTenantId(query.actorUserId)
    if (!tenantId) {
      throw AppException.businessRule('event.creator_tenant_required')
    }

    const { isPlatform, defaultEventPhotoQuota } = await this.tenantRepo.checkQuota(tenantId)

    if (isPlatform) {
      return { requiresContract: false, hasSlot: true, contract: null, defaultEventPhotoQuota }
    }

    const usable = await this.contractRepo.findNextUsable(tenantId)
    const resolved = usable ?? (await this.contractRepo.findMostRecentAccepted(tenantId))

    return {
      requiresContract: true,
      hasSlot: usable !== null,
      contract: resolved
        ? {
            id: resolved.contract.id,
            commercialName: resolved.contract.commercialName,
            eventsTotal: resolved.contract.eventsTotal,
            eventsUsed: resolved.eventsUsed,
            photosPerEvent: resolved.contract.photosPerEvent,
            validUntil: resolved.contract.validUntil,
          }
        : null,
      defaultEventPhotoQuota,
    }
  }
}
