import { Customer } from '@customers/domain/entities'
import {
  CUSTOMER_READ_REPOSITORY,
  CUSTOMER_WRITE_REPOSITORY,
  type ICustomerReadRepository,
  type ICustomerWriteRepository,
} from '@customers/domain/ports'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import { FindOrCreateCustomerCommand } from './find-or-create-customer.command'

@CommandHandler(FindOrCreateCustomerCommand)
export class FindOrCreateCustomerHandler implements ICommandHandler<FindOrCreateCustomerCommand> {
  constructor(
    @Inject(CUSTOMER_READ_REPOSITORY) private readonly readRepo: ICustomerReadRepository,
    @Inject(CUSTOMER_WRITE_REPOSITORY) private readonly writeRepo: ICustomerWriteRepository,
  ) {}

  /** Finds an existing customer by WhatsApp or creates a new one. */
  async execute(command: FindOrCreateCustomerCommand): Promise<EntityIdProjection> {
    const existing = await this.readRepo.findByWhatsApp(command.whatsapp)
    if (existing) return { id: existing.id }

    const customer = Customer.create({
      firstName: command.firstName,
      lastName: command.lastName,
      whatsapp: command.whatsapp,
      email: command.email,
    })

    const saved = await this.writeRepo.save(customer)
    return { id: saved.id }
  }
}
