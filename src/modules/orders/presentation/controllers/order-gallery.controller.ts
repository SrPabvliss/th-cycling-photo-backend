import { Body, Controller, Param, Post } from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import {
  CreateOrderFromGalleryCommand,
  CreateOrderFromGalleryDto,
} from '@orders/application/commands'
import { EntityIdProjection } from '@shared/application'
import { CurrentUser, type ICurrentUser, Roles } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'

@ApiTags('Orders (Gallery)')
@ApiBearerAuth()
@Controller('public/events/:eventId/orders')
export class OrderGalleryController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @Roles('customer')
  @SuccessMessage('success.CREATED', { entity: 'entities.order' })
  @ApiOperation({ summary: 'Create an order from the public gallery (requires authentication)' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Order created successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 401, description: 'Authentication required' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Photos do not belong to event' })
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateOrderFromGalleryDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const command = new CreateOrderFromGalleryCommand(
      eventId,
      user.userId,
      dto.photoIds,
      dto.bibNumber ?? null,
      dto.snapCategoryName ?? null,
    )
    return this.commandBus.execute(command)
  }
}
