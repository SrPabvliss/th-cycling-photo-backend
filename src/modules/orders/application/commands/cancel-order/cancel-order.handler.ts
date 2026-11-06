import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import {
  type IOrderReadRepository,
  type IOrderWriteRepository,
  ORDER_READ_REPOSITORY,
  ORDER_WRITE_REPOSITORY,
} from '@orders/domain/ports'
import type { EntityIdProjection } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import {
  type IInvoiceRequester,
  RIKUCHIY_INVOICE_REQUESTER,
} from '@shared/rikuchiy/domain/ports/invoice-requester.port'
import { CancelOrderCommand } from './cancel-order.command'

@CommandHandler(CancelOrderCommand)
export class CancelOrderHandler implements ICommandHandler<CancelOrderCommand> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY) private readonly writeRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    private readonly prisma: PrismaService,
    @Inject(RIKUCHIY_INVOICE_REQUESTER) private readonly invoiceRequester: IInvoiceRequester,
  ) {}

  async execute(command: CancelOrderCommand): Promise<EntityIdProjection> {
    const scope = await this.authz.resolveEventScope(command.userId, 'order.cancel')
    const order = await this.readRepo.findByIdInScope(command.orderId, scope)
    if (!order) throw AppException.notFound('entities.order', command.orderId)
    await this.authz.assert(command.userId, 'order.cancel', order.eventId)

    order.cancel()
    await this.prisma.$transaction(async (tx) => {
      await this.writeRepo.save(order, tx)
      await this.invoiceRequester.withdraw(order.id, 'cancelled', tx)
    })

    return { id: order.id }
  }
}
