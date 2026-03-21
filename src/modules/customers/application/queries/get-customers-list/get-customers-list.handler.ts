import type { CustomerListProjection } from '@customers/application/projections'
import { CUSTOMER_READ_REPOSITORY, type ICustomerReadRepository } from '@customers/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PaginatedResult } from '@shared/application'
import { GetCustomersListQuery } from './get-customers-list.query'

@QueryHandler(GetCustomersListQuery)
export class GetCustomersListHandler implements IQueryHandler<GetCustomersListQuery> {
  constructor(
    @Inject(CUSTOMER_READ_REPOSITORY) private readonly readRepo: ICustomerReadRepository,
  ) {}

  /** Retrieves a paginated list of customers with optional search. */
  async execute(query: GetCustomersListQuery): Promise<PaginatedResult<CustomerListProjection>> {
    return this.readRepo.getList(query.pagination, query.search)
  }
}
