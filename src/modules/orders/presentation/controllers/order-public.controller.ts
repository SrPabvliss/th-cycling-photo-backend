import { Body, Controller, Param, Post } from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import {
  CreateOrderFromPreviewCommand,
  CreateOrderFromPreviewDto,
} from '@orders/application/commands'
import { EntityIdProjection } from '@shared/application'
import { Public } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Orders (Public)')
@Controller('preview/:token/orders')
export class OrderPublicController {
  constructor(private readonly commandBus: CommandBus) {}

  @Public()
  @Post()
  @SuccessMessage('success.CREATED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Create an order from a preview link (public, no auth required)' })
  @ApiParam({ name: 'token', description: 'Preview link token (64 hex chars)' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Order created successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Preview link not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Preview expired or photos invalid' })
  async create(@Param('token') token: string, @Body() dto: CreateOrderFromPreviewDto) {
    const command = new CreateOrderFromPreviewCommand(
      token,
      dto.photoIds,
      dto.firstName,
      dto.lastName,
      dto.whatsapp,
      dto.email ?? null,
      dto.notes ?? null,
    )
    return this.commandBus.execute(command)
  }
}
