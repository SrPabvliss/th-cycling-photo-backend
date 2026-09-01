import { FreezeStateService } from '@events/application/services/freeze-state.service'
import { EVENT_READ_REPOSITORY, type IEventReadRepository } from '@events/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import {
  EVENT_ASSET_READ_REPOSITORY,
  EVENT_ASSET_WRITE_REPOSITORY,
  type IEventAssetReadRepository,
  type IEventAssetWriteRepository,
} from '../../../domain/ports'
import { SetAssetFocalPointCommand } from './set-asset-focal-point.command'

@CommandHandler(SetAssetFocalPointCommand)
export class SetAssetFocalPointHandler implements ICommandHandler<SetAssetFocalPointCommand> {
  constructor(
    @Inject(EVENT_READ_REPOSITORY) private readonly eventReadRepo: IEventReadRepository,
    @Inject(EVENT_ASSET_READ_REPOSITORY) private readonly readRepo: IEventAssetReadRepository,
    @Inject(EVENT_ASSET_WRITE_REPOSITORY) private readonly writeRepo: IEventAssetWriteRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly freeze: FreezeStateService,
  ) {}

  async execute(command: SetAssetFocalPointCommand): Promise<EntityIdProjection> {
    const scope = await this.authz.resolveEventScope(command.userId)
    const event = await this.eventReadRepo.findByIdInScope(command.eventId, scope)
    if (!event) throw AppException.notFound('Event', command.eventId)
    await this.authz.assert(command.userId, 'event_asset.confirm', event.id)
    await this.freeze.assertNotFrozen(command.eventId)

    const asset = await this.readRepo.findByEventAndType(command.eventId, command.assetType)
    if (!asset) throw AppException.notFound('EventAsset', command.assetType)

    asset.moveFocalPoint(command.focalX, command.focalY)
    const saved = await this.writeRepo.save(asset)

    return { id: saved.id }
  }
}
