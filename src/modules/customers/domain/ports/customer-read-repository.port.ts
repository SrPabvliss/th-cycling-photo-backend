import type { CustomerListProjection } from '@customers/application/projections'
import type { PaginatedResult, Pagination } from '@shared/application'
import type { Customer } from '../entities'

export interface ICustomerReadRepository {
  findByWhatsApp(whatsapp: string): Promise<Customer | null>
  getList(pagination: Pagination, search?: string): Promise<PaginatedResult<CustomerListProjection>>
}

export const CUSTOMER_READ_REPOSITORY = Symbol('CUSTOMER_READ_REPOSITORY')
