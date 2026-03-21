import type { Customer } from '../entities'

export interface ICustomerWriteRepository {
  save(customer: Customer): Promise<Customer>
}

export const CUSTOMER_WRITE_REPOSITORY = Symbol('CUSTOMER_WRITE_REPOSITORY')
