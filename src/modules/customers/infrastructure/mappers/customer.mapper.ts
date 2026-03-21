import type { CustomerListProjection } from '@customers/application/projections'
import { Customer } from '@customers/domain/entities'
import type { Prisma, Customer as PrismaCustomer } from '@generated/prisma/client'

type CustomerListSelect = {
  id: string
  first_name: string
  last_name: string
  whatsapp: string
  email: string | null
  created_at: Date
  _count: { orders: number }
}

/** Converts a domain entity to a Prisma create input. */
export function toPersistence(entity: Customer): Prisma.CustomerUncheckedCreateInput {
  return {
    id: entity.id,
    first_name: entity.firstName,
    last_name: entity.lastName,
    whatsapp: entity.whatsapp,
    email: entity.email,
    created_at: entity.createdAt,
  }
}

/** Converts a Prisma record to a domain entity. */
export function toEntity(record: PrismaCustomer): Customer {
  return Customer.fromPersistence({
    id: record.id,
    firstName: record.first_name,
    lastName: record.last_name,
    whatsapp: record.whatsapp,
    email: record.email,
    createdAt: record.created_at,
  })
}

/** Converts a Prisma selected record to a list projection. */
export function toListProjection(record: CustomerListSelect): CustomerListProjection {
  return {
    id: record.id,
    firstName: record.first_name,
    lastName: record.last_name,
    whatsapp: record.whatsapp,
    email: record.email,
    createdAt: record.created_at,
    orderCount: record._count.orders,
  }
}
