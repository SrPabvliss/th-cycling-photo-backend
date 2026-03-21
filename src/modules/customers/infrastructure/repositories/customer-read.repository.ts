import type { CustomerListProjection } from '@customers/application/projections'
import type { Customer } from '@customers/domain/entities'
import type { ICustomerReadRepository } from '@customers/domain/ports'
import type { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PaginatedResult, type Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import * as CustomerMapper from '../mappers/customer.mapper'

const CUSTOMER_LIST_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  whatsapp: true,
  email: true,
  created_at: true,
  _count: { select: { orders: true } },
} as const

@Injectable()
export class CustomerReadRepository implements ICustomerReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds a customer by WhatsApp number. */
  async findByWhatsApp(whatsapp: string): Promise<Customer | null> {
    const record = await this.prisma.customer.findFirst({
      where: { whatsapp },
    })
    return record ? CustomerMapper.toEntity(record) : null
  }

  /** Retrieves a paginated list of customers with optional search. */
  async getList(
    pagination: Pagination,
    search?: string,
  ): Promise<PaginatedResult<CustomerListProjection>> {
    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } },
            { whatsapp: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        select: CUSTOMER_LIST_SELECT,
        orderBy: { created_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.customer.count({ where }),
    ])

    return new PaginatedResult(
      customers.map((c) => CustomerMapper.toListProjection(c)),
      total,
      pagination,
    )
  }
}
