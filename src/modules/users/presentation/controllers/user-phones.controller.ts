import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { EntityIdProjection } from '@shared/application'
import { CurrentUser, type ICurrentUser } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import {
  AddUserPhoneCommand,
  AddUserPhoneDto,
  DeleteUserPhoneCommand,
  SetPrimaryPhoneCommand,
  UpdateUserPhoneCommand,
  UpdateUserPhoneDto,
} from '@users/application/commands'
import { UserPhoneProjection } from '@users/application/projections'
import { GetUserPhonesQuery } from '@users/application/queries'

@ApiTags('User Phones')
@ApiBearerAuth()
@Controller('users/me/phones')
export class UserPhonesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List my phones' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Phone list',
    type: UserPhoneProjection,
    isArray: true,
  })
  async findAll(@CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetUserPhonesQuery(user.userId))
  }

  @Post()
  @SuccessMessage('success.CREATED', { entity: 'entities.user_phone' })
  @ApiOperation({ summary: 'Add a phone number' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Phone added successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  async create(@Body() dto: AddUserPhoneDto, @CurrentUser() user: ICurrentUser) {
    const command = new AddUserPhoneCommand(user.userId, dto.phoneNumber, dto.label, dto.isWhatsapp)
    return this.commandBus.execute(command)
  }

  @Patch(':phoneId')
  @SuccessMessage('success.UPDATED', { entity: 'entities.user_phone' })
  @ApiOperation({ summary: 'Update a phone number' })
  @ApiParam({ name: 'phoneId', description: 'Phone UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Phone updated successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Phone not found' })
  async update(
    @Param('phoneId') phoneId: string,
    @Body() dto: UpdateUserPhoneDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const command = new UpdateUserPhoneCommand(
      user.userId,
      phoneId,
      dto.phoneNumber,
      dto.label,
      dto.isWhatsapp,
    )
    return this.commandBus.execute(command)
  }

  @Delete(':phoneId')
  @SuccessMessage('success.DELETED', { entity: 'entities.user_phone' })
  @ApiOperation({ summary: 'Delete a phone number' })
  @ApiParam({ name: 'phoneId', description: 'Phone UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Phone deleted successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Phone not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Cannot delete last or primary phone' })
  async remove(@Param('phoneId') phoneId: string, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new DeleteUserPhoneCommand(user.userId, phoneId))
  }

  @Patch(':phoneId/primary')
  @SuccessMessage('success.UPDATED', { entity: 'entities.user_phone' })
  @ApiOperation({ summary: 'Set a phone as primary' })
  @ApiParam({ name: 'phoneId', description: 'Phone UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Phone set as primary',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Phone not found' })
  async setPrimary(@Param('phoneId') phoneId: string, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new SetPrimaryPhoneCommand(user.userId, phoneId))
  }
}
