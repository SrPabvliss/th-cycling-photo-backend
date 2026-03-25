import { CUSTOMER_READ_REPOSITORY, type ICustomerReadRepository } from '@customers/domain/ports'
import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { CustomerPublicProjection } from '@previews/application/projections'
import {
  type IPreviewLinkReadRepository,
  PREVIEW_LINK_READ_REPOSITORY,
} from '@previews/domain/ports'
import { AppException } from '@shared/domain'
import { GetCustomerByWhatsAppQuery } from './get-customer-by-whatsapp.query'

@QueryHandler(GetCustomerByWhatsAppQuery)
export class GetCustomerByWhatsAppHandler implements IQueryHandler<GetCustomerByWhatsAppQuery> {
  constructor(
    @Inject(PREVIEW_LINK_READ_REPOSITORY)
    private readonly previewReadRepo: IPreviewLinkReadRepository,
    @Inject(CUSTOMER_READ_REPOSITORY)
    private readonly customerReadRepo: ICustomerReadRepository,
  ) {}

  async execute(query: GetCustomerByWhatsAppQuery): Promise<CustomerPublicProjection> {
    // Validate preview token exists (ensures this is accessed from a valid preview)
    const previewLink = await this.previewReadRepo.findByToken(query.token)
    if (!previewLink) throw AppException.notFound('entities.preview_link', query.token)

    // Search customer by WhatsApp
    const customer = await this.customerReadRepo.findByWhatsApp(query.whatsapp)
    if (!customer) throw AppException.notFound('entities.customer', query.whatsapp)

    return {
      firstName: customer.firstName,
      lastName: customer.lastName,
      whatsapp: customer.whatsapp,
      email: customer.email,
    }
  }
}
