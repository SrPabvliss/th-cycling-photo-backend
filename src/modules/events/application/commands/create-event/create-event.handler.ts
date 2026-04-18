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
import { CreateEventCommand } from './create-event.command'

@CommandHandler(CreateEventCommand)
export class CreateEventHandler implements ICommandHandler<CreateEventCommand> {
  private readonly logger = new Logger(CreateEventHandler.name)

  constructor(
    @Inject(EVENT_WRITE_REPOSITORY) private readonly writeRepo: IEventWriteRepository,
    @Inject(EVENT_OPERATOR_REPOSITORY) private readonly operatorRepo: IEventOperatorRepository,
    private readonly locationValidator: LocationValidator,
  ) {}

  /** Creates a new event entity and persists it. */
  async execute(command: CreateEventCommand): Promise<EntityIdProjection> {
    await this.locationValidator.validate(command.provinceId, command.cantonId)

    const event = Event.create({
      name: command.name,
      description: command.description,
      date: command.date,
      provinceId: command.provinceId,
      cantonId: command.cantonId,
      eventTypeId: command.eventTypeId,
    })

    if (command.audit) event.audit.setCreatedBy(command.audit.userId)

    const saved = await this.writeRepo.save(event)

    // Auto-assign first available operator
    const operatorId = await this.operatorRepo.findFirstOperatorId()
    if (operatorId) {
      const assignedById = command.audit?.userId ?? operatorId
      await this.operatorRepo.assign(saved.id, operatorId, assignedById)
      this.logger.log(`Auto-assigned operator ${operatorId} to event ${saved.id}`)
    }

    return { id: saved.id }
  }
}
