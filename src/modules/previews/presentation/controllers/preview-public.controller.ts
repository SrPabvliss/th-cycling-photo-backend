import { Controller, Get, Param, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { CustomerPublicProjection, PreviewDataProjection } from '@previews/application/projections'
import {
  GetCustomerByWhatsAppDto,
  GetCustomerByWhatsAppQuery,
  GetPreviewByTokenQuery,
} from '@previews/application/queries'
import { Public } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Preview (Public)')
@Controller('preview')
export class PreviewPublicController {
  constructor(private readonly queryBus: QueryBus) {}

  @Public()
  @Get(':token')
  @SuccessMessage('success.FETCHED', { entity: 'entities.preview_link' })
  @ApiOperation({ summary: 'Get preview data by token (public, no auth required)' })
  @ApiParam({ name: 'token', description: 'Preview link token (64 hex chars)' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Preview data with watermarked photo URLs',
    type: PreviewDataProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Preview link not found' })
  @ApiEnvelopeErrorResponse({ status: 410, description: 'Preview link has expired' })
  async getByToken(@Param('token') token: string) {
    const query = new GetPreviewByTokenQuery(token)
    return this.queryBus.execute(query)
  }

  @Public()
  @Get(':token/customer')
  @SuccessMessage('success.FETCHED', { entity: 'entities.customer' })
  @ApiOperation({ summary: 'Find customer by WhatsApp for form autocomplete (public)' })
  @ApiParam({ name: 'token', description: 'Preview link token (64 hex chars)' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Customer data for autocomplete',
    type: CustomerPublicProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Customer or preview link not found' })
  async findCustomer(@Param('token') token: string, @Query() dto: GetCustomerByWhatsAppDto) {
    const query = new GetCustomerByWhatsAppQuery(token, dto.whatsapp)
    return this.queryBus.execute(query)
  }
}
