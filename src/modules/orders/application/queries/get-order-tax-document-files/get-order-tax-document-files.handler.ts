import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import {
  isTaxDocumentDownloadable,
  type TaxDocumentFilesProjection,
} from '@orders/application/projections'
import { type IOrderReadRepository, ORDER_READ_REPOSITORY } from '@orders/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import {
  type IOrderTaxDocumentRepository,
  type IRikuchiyClient,
  ORDER_TAX_DOCUMENT_REPOSITORY,
  RIKUCHIY_CLIENT,
} from '@shared/rikuchiy/domain/ports'
import { GetOrderTaxDocumentFilesQuery } from './get-order-tax-document-files.query'

@QueryHandler(GetOrderTaxDocumentFilesQuery)
export class GetOrderTaxDocumentFilesHandler
  implements IQueryHandler<GetOrderTaxDocumentFilesQuery>
{
  constructor(
    @Inject(ORDER_READ_REPOSITORY) private readonly readRepo: IOrderReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
    @Inject(ORDER_TAX_DOCUMENT_REPOSITORY)
    private readonly orderTaxDocumentRepository: IOrderTaxDocumentRepository,
    @Inject(RIKUCHIY_CLIENT) private readonly rikuchiyClient: IRikuchiyClient,
  ) {}

  async execute(query: GetOrderTaxDocumentFilesQuery): Promise<TaxDocumentFilesProjection> {
    if (!(await this.canAccessOrder(query))) {
      throw AppException.notFound('entities.order', query.orderId)
    }

    const documents = await this.orderTaxDocumentRepository.findByOrder(query.orderId)
    const document = documents.find((candidate) => candidate.id === query.taxDocumentId)
    if (!document || !isTaxDocumentDownloadable(document)) {
      throw AppException.notFound('entities.tax_document', query.taxDocumentId)
    }

    const result = await this.rikuchiyClient.getDocumentFiles(document.id)
    if (result.kind === 'not_stored') {
      throw AppException.businessRule('order.invoice_files_not_ready')
    }
    if (result.kind === 'unavailable') throw AppException.externalService('rikuchiy')

    return {
      xml: { url: result.xml.url, expiresAt: result.xml.expiresAt },
      pdf: { url: result.pdf.url, expiresAt: result.pdf.expiresAt },
    }
  }

  private async canAccessOrder(query: GetOrderTaxDocumentFilesQuery): Promise<boolean> {
    if (query.actor === 'buyer') {
      return this.readRepo.existsOwnedBy(query.userId, query.orderId)
    }
    const scope = await this.authz.resolveEventScope(query.userId, 'order.read')
    const order = await this.readRepo.findByIdInScope(query.orderId, scope)
    return order !== null
  }
}
