import { FindOrCreateCustomerHandler } from '@customers/application/commands/find-or-create-customer/find-or-create-customer.handler'
import { GetCustomersListHandler } from '@customers/application/queries/get-customers-list/get-customers-list.handler'
import { CUSTOMER_READ_REPOSITORY, CUSTOMER_WRITE_REPOSITORY } from '@customers/domain/ports'
import { CustomerReadRepository } from '@customers/infrastructure/repositories/customer-read.repository'
import { CustomerWriteRepository } from '@customers/infrastructure/repositories/customer-write.repository'
import { CustomersController } from '@customers/presentation/controllers/customers.controller'
import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

const CommandHandlers = [FindOrCreateCustomerHandler]
const QueryHandlers = [GetCustomersListHandler]

@Module({
  imports: [CqrsModule],
  controllers: [CustomersController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    { provide: CUSTOMER_READ_REPOSITORY, useClass: CustomerReadRepository },
    { provide: CUSTOMER_WRITE_REPOSITORY, useClass: CustomerWriteRepository },
  ],
  exports: [CUSTOMER_READ_REPOSITORY, CUSTOMER_WRITE_REPOSITORY],
})
export class CustomersModule {}
