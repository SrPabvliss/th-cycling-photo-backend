import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { EntityIdProjection, Pagination } from '@shared/application'
import { Roles } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import {
  ConfirmAvatarUploadCommand,
  ConfirmAvatarUploadDto,
  CreateUserCommand,
  CreateUserDto,
  DeactivateUserCommand,
  GenerateAvatarUrlCommand,
  GenerateAvatarUrlDto,
  ReactivateUserCommand,
  ResetPasswordCommand,
  ResetPasswordDto,
  UpdateUserCommand,
  UpdateUserDto,
} from '@users/application/commands'
import {
  AvatarPresignedUrlProjection,
  UserDetailProjection,
  UserListProjection,
} from '@users/application/projections'
import { GetUserDetailQuery, GetUsersListDto, GetUsersListQuery } from '@users/application/queries'

@ApiTags('Users')
@ApiBearerAuth()
@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List users with pagination' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Paginated user list',
    type: UserListProjection,
    isArray: true,
  })
  async findAll(@Query() dto: GetUsersListDto) {
    const pagination = new Pagination(dto.page ?? 1, dto.limit ?? 20)
    const query = new GetUsersListQuery(pagination, dto.includeInactive ?? false)
    return this.queryBus.execute(query)
  }

  @Get(':id')
  @SuccessMessage('success.FETCHED', { entity: 'entities.user' })
  @ApiOperation({ summary: 'Get user details by ID' })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'User detail retrieved',
    type: UserDetailProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    return this.queryBus.execute(new GetUserDetailQuery(id))
  }

  @Post()
  @SuccessMessage('success.CREATED', { entity: 'entities.user' })
  @ApiOperation({ summary: 'Create a new user (admin only)' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'User created successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 409, description: 'Email already exists' })
  async create(@Body() dto: CreateUserDto) {
    const command = new CreateUserCommand(
      dto.firstName,
      dto.lastName,
      dto.email,
      dto.phone ?? null,
      dto.role,
      dto.password,
    )
    return this.commandBus.execute(command)
  }

  @Patch(':id')
  @SuccessMessage('success.UPDATED', { entity: 'entities.user' })
  @ApiOperation({ summary: 'Update user profile' })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'User updated successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'User not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const command = new UpdateUserCommand(id, dto.firstName, dto.lastName, dto.phone)
    return this.commandBus.execute(command)
  }

  @Patch(':id/deactivate')
  @SuccessMessage('success.UPDATED', { entity: 'entities.user' })
  @ApiOperation({ summary: 'Deactivate a user account' })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'User deactivated successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'User not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'User is already deactivated' })
  async deactivate(@Param('id') id: string) {
    return this.commandBus.execute(new DeactivateUserCommand(id))
  }

  @Patch(':id/reactivate')
  @SuccessMessage('success.UPDATED', { entity: 'entities.user' })
  @ApiOperation({ summary: 'Reactivate a user account' })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'User reactivated successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'User not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'User is already active' })
  async reactivate(@Param('id') id: string) {
    return this.commandBus.execute(new ReactivateUserCommand(id))
  }

  @Post(':id/reset-password')
  @SuccessMessage('success.UPDATED', { entity: 'entities.password' })
  @ApiOperation({ summary: 'Reset user password (admin only)' })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Password reset successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'User not found' })
  async resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.commandBus.execute(new ResetPasswordCommand(id, dto.newPassword))
  }

  @Post(':id/avatar/presigned-url')
  @SuccessMessage('success.CREATED', { entity: 'entities.presigned_url' })
  @ApiOperation({ summary: 'Generate a presigned URL for avatar upload' })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Presigned URL generated',
    type: AvatarPresignedUrlProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'User not found' })
  async generateAvatarUrl(@Param('id') id: string, @Body() dto: GenerateAvatarUrlDto) {
    return this.commandBus.execute(new GenerateAvatarUrlCommand(id, dto.fileName, dto.contentType))
  }

  @Post(':id/avatar/confirm')
  @SuccessMessage('success.UPDATED', { entity: 'entities.avatar' })
  @ApiOperation({ summary: 'Confirm avatar upload after presigned URL flow' })
  @ApiParam({ name: 'id', description: 'User UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Avatar confirmed successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'User not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Invalid storage key' })
  async confirmAvatar(@Param('id') id: string, @Body() dto: ConfirmAvatarUploadDto) {
    return this.commandBus.execute(new ConfirmAvatarUploadCommand(id, dto.storageKey))
  }
}
