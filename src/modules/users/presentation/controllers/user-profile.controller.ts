import { Body, Controller, Get, Patch, Post } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { EntityIdProjection } from '@shared/application'
import { CurrentUser, type ICurrentUser } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import {
  ConfirmAvatarUploadCommand,
  ConfirmAvatarUploadDto,
  GenerateAvatarUrlCommand,
  GenerateAvatarUrlDto,
  UpdateMyProfileCommand,
  UpdateMyProfileDto,
} from '@users/application/commands'
import { AvatarPresignedUrlProjection, MyProfileProjection } from '@users/application/projections'
import { GetMyProfileQuery } from '@users/application/queries'

@ApiTags('My Profile')
@ApiBearerAuth()
@Controller('users/me')
export class UserProfileController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @SuccessMessage('success.FETCHED', { entity: 'entities.user' })
  @ApiOperation({ summary: 'Get my profile' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: MyProfileProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'User not found' })
  async findMine(@CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetMyProfileQuery(user.userId))
  }

  @Patch()
  @SuccessMessage('success.UPDATED', { entity: 'entities.user' })
  @ApiOperation({ summary: 'Update my profile' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 400, description: 'Validation failed' })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'User not found' })
  async updateMine(@Body() dto: UpdateMyProfileDto, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new UpdateMyProfileCommand(user.userId, dto))
  }

  @Post('avatar/presigned-url')
  @SuccessMessage('success.CREATED', { entity: 'entities.presigned_url' })
  @ApiOperation({ summary: 'Generate a presigned URL for avatar upload' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Presigned URL generated',
    type: AvatarPresignedUrlProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'User not found' })
  async generateAvatarUrl(@Body() dto: GenerateAvatarUrlDto, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(
      new GenerateAvatarUrlCommand(user.userId, dto.fileName, dto.contentType),
    )
  }

  @Post('avatar/confirm')
  @SuccessMessage('success.UPDATED', { entity: 'entities.avatar' })
  @ApiOperation({ summary: 'Confirm avatar upload after presigned URL flow' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Avatar confirmed successfully',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'User not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Invalid storage key' })
  async confirmAvatar(@Body() dto: ConfirmAvatarUploadDto, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new ConfirmAvatarUploadCommand(user.userId, dto.storageKey))
  }
}
