import type { Customer } from '@customers/domain/entities'
import type { ICustomerWriteRepository } from '@customers/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import * as CustomerMapper from '../mappers/customer.mapper'

@Injectable()
export class CustomerWriteRepository implements ICustomerWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persists a customer entity (create or update). */
  async save(customer: Customer): Promise<Customer> {
    const data = CustomerMapper.toPersistence(customer)

    const saved = await this.prisma.customer.upsert({
      where: { id: customer.id },
      create: data,
      update: data,
    })

    return CustomerMapper.toEntity(saved)
  }
}
