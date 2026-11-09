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
import { ConvertOrderToSaleCommand } from './convert-order-to-sale.command'

@CommandHandler(ConvertOrderToSaleCommand)
export class ConvertOrderToSaleHandler implements ICommandHandler<ConvertOrderToSaleCommand> {
  constructor(
    @Inject(ORDER_WRITE_REPOSITORY)
    private readonly writeRepo: IOrderWriteRepository,
    @Inject(ORDER_READ_REPOSITORY)
    private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE)
    private readonly authz: IAuthorizationService,
    private readonly prisma: PrismaService,
    @Inject(RIKUCHIY_INVOICE_REQUESTER) private readonly invoiceRequester: IInvoiceRequester,
  ) {}

  async execute(command: ConvertOrderToSaleCommand): Promise<EntityIdProjection> {
    const scope = await this.authz.resolveEventScope(command.audit.userId, 'order.convert_to_sale')
    const order = await this.readRepo.findByIdInScope(command.orderId, scope)
    if (!order) throw AppException.notFound('entities.order', command.orderId)
    await this.authz.assert(command.audit.userId, 'order.convert_to_sale', order.eventId)

    order.convertToSale(command.audit.userId)
    await this.prisma.$transaction(async (tx) => {
      await this.writeRepo.save(order, tx)
      await this.invoiceRequester.request(order.id, tx)
    })

    return { id: order.id }
  }
}
