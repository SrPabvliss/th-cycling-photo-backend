import {
  EVENT_PAYOUT_METHOD_REPOSITORY,
  EVENT_READ_REPOSITORY,
  type IEventPayoutMethodRepository,
  type IEventReadRepository,
} from '@events/domain/ports'
import { EventStatus } from '@events/domain/value-objects/event-status.vo'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import { AppException } from '@shared/domain'
import { EventConfigurationProjection } from '../../projections/event-configuration.projection'
import { GetEventConfigurationQuery } from './get-event-configuration.query'

@QueryHandler(GetEventConfigurationQuery)
export class GetEventConfigurationHandler implements IQueryHandler<GetEventConfigurationQuery> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(EVENT_PAYOUT_METHOD_REPOSITORY)
    private readonly payoutRepo: IEventPayoutMethodRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  async execute(query: GetEventConfigurationQuery): Promise<EventConfigurationProjection> {
    const scope = await this.authz.resolveEventScope(query.actorUserId)
    const event = await this.readRepo.findByIdInScope(query.id, scope, true)
    if (!event) throw AppException.notFound('Event', query.id)

    const methods = await this.payoutRepo.findByEventId(event.id)

    return {
      publicName: event.snapPublicName,
      watermarkStorageKey: event.snapWatermarkStorageKey,
      watermarkUrl: event.snapWatermarkStorageKey
        ? this.cdn.eventWatermarkUrl(event.id, event.snapWatermarkStorageKey)
        : null,
      whatsappNumber: event.snapWhatsappNumber,
      payoutMethods: methods.map((method) => ({
        id: method.id,
        provider: method.provider,
        isActive: method.isActive,
        sortOrder: method.sortOrder,
        receiverIdentifier: method.receiverIdentifier,
        bankName: method.bankName,
        accountNumber: method.accountNumber,
        accountType: method.accountType,
        accountHolder: method.accountHolder,
        holderIdentification: method.holderIdentification,
        sourcePayoutMethodId: method.sourcePayoutMethodId,
      })),
      isEditable: !event.isFrozen && event.status !== EventStatus.ARCHIVED,
    }
  }
}
