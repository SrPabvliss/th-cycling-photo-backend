import { randomUUID } from 'node:crypto'
import type { Prisma } from '@generated/prisma/client'
import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  type IInvoiceRequester,
  type IInvoiceSourceReader,
  INVOICE_SOURCE_READER,
  type IRikuchiyOutboxRepository,
  RIKUCHIY_OUTBOX_REPOSITORY,
} from '../../domain/ports'
import { RikuchiyEmission } from '../../domain/rikuchiy-emission'

@Injectable()
export class RikuchiyInvoiceRequesterService implements IInvoiceRequester {
  private readonly logger = new Logger(RikuchiyInvoiceRequesterService.name)

  constructor(
    @Inject(INVOICE_SOURCE_READER) private readonly invoiceSourceReader: IInvoiceSourceReader,
    @Inject(RIKUCHIY_OUTBOX_REPOSITORY)
    private readonly rikuchiyOutboxRepository: IRikuchiyOutboxRepository,
  ) {}

  async request(orderId: string, tx: Prisma.TransactionClient): Promise<void> {
    const source = await this.invoiceSourceReader.find(orderId, tx)
    if (!source) {
      this.logger.error(`no invoice requested: order not found. orderId=${orderId}`)
      return
    }

    const emissionId = randomUUID()
    const build = RikuchiyEmission.build(source, emissionId)

    if (build.kind === 'skip') {
      if (build.reason === 'not_a_sale') return
      const message = `no invoice requested: ${build.reason}. orderId=${orderId}`
      if (build.reason === 'no_billing_data') this.logger.warn(message)
      else this.logger.error(message)
      return
    }

    await this.rikuchiyOutboxRepository.enqueue({ orderId, emissionId, payload: build.payload }, tx)
  }

  async withdraw(orderId: string, tx: Prisma.TransactionClient): Promise<void> {
    const result = await this.rikuchiyOutboxRepository.suppressPending(orderId, tx)
    if (result === 'already_sent') {
      this.logger.error(`invoice already sent to rikuchiy; annul it by hand. orderId=${orderId}`)
    }
  }
}
