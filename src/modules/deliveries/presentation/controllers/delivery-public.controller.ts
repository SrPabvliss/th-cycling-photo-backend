import { DeliveryDataProjection } from '@deliveries/application/projections'
import { GetDeliveryByTokenQuery } from '@deliveries/application/queries'
import { Controller, Get, Param } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { Public } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Delivery (Public)')
@Controller('delivery')
export class DeliveryPublicController {
  constructor(private readonly queryBus: QueryBus) {}

  @Public()
  // Cap brute-force / enumeration against the public delivery endpoint.
  // 10 lookups/minute per IP is well above any legitimate single-customer
  // usage (one fetch on page load, one refresh per ~50 min).
  @Throttle({ sensitive_token: { limit: 10, ttl: 60000 } })
  @Get(':token')
  @SuccessMessage('success.FETCHED', { entity: 'entities.delivery_link' })
  @ApiOperation({ summary: 'Get delivery data by token (public, no auth required)' })
  @ApiParam({ name: 'token', description: 'Delivery link token (64 hex chars)' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Delivery data with presigned download URLs',
    type: DeliveryDataProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Delivery link not found' })
  @ApiEnvelopeErrorResponse({ status: 410, description: 'Delivery link has expired' })
  async getByToken(@Param('token') token: string) {
    const query = new GetDeliveryByTokenQuery(token)
    return this.queryBus.execute(query)
  }
}
