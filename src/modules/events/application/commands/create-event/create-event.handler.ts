import { Event } from '@events/domain/entities'
import { EVENT_WRITE_REPOSITORY, type IEventWriteRepository } from '@events/domain/ports'
import {
  EVENT_OPERATOR_REPOSITORY,
  type IEventOperatorRepository,
} from '@events/domain/ports/event-operator-repository.port'
import { LocationValidator } from '@locations/application/services'
import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { AppException } from '@shared/domain'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import { TENANT_REPOSITORY, type ITenantRepository } from '../../../../tenants/domain/ports/tenant-repository.port'
import { CreateEventCommand } from './create-event.command'

@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
  private readonly logger = new Logger(CreateEventHandler.name)

  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_OPERATOR_REPOSITORY) private readonly operatorRepo: IEventOperatorRepository,
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: ITenantRepository,
    private readonly locationValidator: LocationValidator,
  ) {}

  /** Creates a new event entity and persists it. */
  async execute(command: CreateEventCommand): Promise<EntityIdProjection> {
    await this.locationValidator.validate(command.provinceId, command.cantonId)

    // An event always belongs to its creator's tenant. Buyers and other
    // tenant-less users cannot create events.
    const tenantId = await this.userRepo.findTenantId(command.audit.userId)
    if (!tenantId) {
      throw AppException.businessRule('event.creator_tenant_required')
    }

    const { quota, used, isPlatform } = await this.tenantRepo.checkQuota(tenantId)
    if (!isPlatform && used >= quota) {
      throw AppException.businessRule('tenant.quota_exceeded')
    }

    const event = Event.create({
      name: command.name,
      startDate: command.startDate,
      endDate: command.endDate,
      provinceId: command.provinceId,
      cantonId: command.cantonId,
      eventTypeId: command.eventTypeId,
      tenantId,
    })

    event.audit.setCreatedBy(command.audit.userId)

    const saved = await this.writeRepo.save(event)

    // Auto-assign first available operator
    const operatorId = await this.operatorRepo.findFirstOperatorId()
    if (operatorId) {
      const assignedById = command.audit.userId
      await this.operatorRepo.assign(saved.id, operatorId, assignedById)
      this.logger.log(`Auto-assigned operator ${operatorId} to event ${saved.id}`)
    }

    return { id: saved.id }
  }
}
