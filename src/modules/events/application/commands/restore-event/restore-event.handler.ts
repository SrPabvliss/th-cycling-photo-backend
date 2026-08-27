import {
  EVENT_READ_REPOSITORY,
  EVENT_WRITE_REPOSITORY,
  type IEventReadRepository,
  type IEventWriteRepository,
} from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import {
  CONTRACT_REPOSITORY,
  type IContractRepository,
} from '../../../../contracts/domain/ports/contract-repository.port'
import {
  type ITenantRepository,
  TENANT_REPOSITORY,
} from '../../../../tenants/domain/ports/tenant-repository.port'
import { RestoreEventCommand } from './restore-event.command'

@CommandHandler(RestoreEventCommand)
export class RestoreEventHandler implements ICommandHandler<RestoreEventCommand> {
  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_READ_REPOSITORY) private readonly readRepo: IEventReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: ITenantRepository,
    @Inject(CONTRACT_REPOSITORY) private readonly contractRepo: IContractRepository,
  ) {}

  /** Restores an archived event back to active status. */
  async execute(command: RestoreEventCommand): Promise<EntityIdProjection> {
    const scope = await this.authz.resolveEventScope(command.userId)
    const event = await this.readRepo.findByIdInScope(command.id, scope, true)
    if (!event) throw AppException.notFound('Event', command.id)

    await this.authz.assert(command.userId, 'event.restore', event.id)
    event.assertNotFrozen()

    await this.assertRestoreDoesNotOversubscribe(event.tenantId, event.photosUploaded, event.contractId)

    event.restore()
    await this.writeRepo.save(event)

    return { id: event.id }
  }

  /**
   * Soft-deleted events with photos_uploaded = 0 do not hold a contract slot
   * (EVENT_SLOT_CONSUMED_FILTER). Restoring one would newly consume capacity —
   * refuse when the tenant has no usable slot left.
   * Events that already uploaded photos keep their slot while deleted, so restore is free.
   */
  private async assertRestoreDoesNotOversubscribe(
    tenantId: string,
    photosUploaded: number,
    contractId: string | null,
  ): Promise<void> {
    if (photosUploaded > 0) return
    if (!contractId) return

    const { isPlatform } = await this.tenantRepo.checkQuota(tenantId)
    if (isPlatform) return

    const usable = await this.contractRepo.findNextUsable(tenantId)
    if (!usable) {
      throw AppException.businessRule('event.no_contract_available')
    }
  }
}
