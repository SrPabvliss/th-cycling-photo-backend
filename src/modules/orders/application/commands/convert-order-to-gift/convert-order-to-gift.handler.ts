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
import { ConvertOrderToGiftCommand } from './convert-order-to-gift.command'

@CommandHandler(ConvertOrderToGiftCommand)
export class ConvertOrderToGiftHandler implements ICommandHandler<ConvertOrderToGiftCommand> {
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

  async execute(command: ConvertOrderToGiftCommand): Promise<EntityIdProjection> {
    const scope = await this.authz.resolveEventScope(command.audit.userId)
    const order = await this.readRepo.findByIdInScope(command.orderId, scope)
    if (!order) throw AppException.notFound('entities.order', command.orderId)
    await this.authz.assert(command.audit.userId, 'order.convert_to_gift', order.eventId)

    order.convertToGift(command.audit.userId)
    await this.prisma.$transaction(async (tx) => {
      await this.writeRepo.save(order, tx)
      await this.invoiceRequester.withdraw(order.id, tx)
    })

    return { id: order.id }
  }
}
