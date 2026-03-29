import type { EventAssetType } from '@generated/prisma/client'
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { EntityIdProjection } from '@shared/application'
import { Public, Roles } from '@shared/auth'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import {
  ConfirmAssetUploadCommand,
  ConfirmAssetUploadDto,
  DeleteEventAssetCommand,
  GenerateAssetPresignedUrlCommand,
  GenerateAssetPresignedUrlDto,
} from '../../application/commands'
import { AssetPresignedUrlProjection, EventAssetProjection } from '../../application/projections'
import { GetEventAssetsQuery } from '../../application/queries'

@ApiTags('Event Assets')
@ApiBearerAuth()
@Controller('events/:eventId/assets')
export class EventAssetsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Public()
  @Get()
  @SuccessMessage('success.LIST')
  @ApiOperation({ summary: 'List all assets for an event' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Event assets retrieved',
    type: EventAssetProjection,
    isArray: true,
  })
  async getAssets(@Param('eventId') eventId: string) {
    return this.queryBus.execute(new GetEventAssetsQuery(eventId))
  }

  @Roles('admin')
  @Post(':assetType/presigned-url')
  @SuccessMessage('success.CREATED', { entity: 'entities.presigned_url' })
  @ApiOperation({ summary: 'Generate presigned URL for asset upload' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiParam({
    name: 'assetType',
    description: 'Asset type',
    enum: ['cover_image', 'event_logo', 'hero_image', 'poster'],
  })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Presigned URL generated',
    type: AssetPresignedUrlProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  async generatePresignedUrl(
    @Param('eventId') eventId: string,
    @Param('assetType') assetType: EventAssetType,
    @Body() dto: GenerateAssetPresignedUrlDto,
  ) {
    const command = new GenerateAssetPresignedUrlCommand(
      eventId,
      assetType,
      dto.fileName,
      dto.contentType,
    )
    return this.commandBus.execute(command)
  }

  @Roles('admin')
  @Post(':assetType/confirm')
  @SuccessMessage('success.UPDATED', { entity: 'entities.event_asset' })
  @ApiOperation({ summary: 'Confirm asset upload after presigned URL flow' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiParam({
    name: 'assetType',
    description: 'Asset type',
    enum: ['cover_image', 'event_logo', 'hero_image', 'poster'],
  })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Asset upload confirmed',
    type: EntityIdProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Event not found' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'Invalid storage key' })
  async confirmUpload(
    @Param('eventId') eventId: string,
    @Param('assetType') assetType: EventAssetType,
    @Body() dto: ConfirmAssetUploadDto,
  ) {
    const command = new ConfirmAssetUploadCommand(
      eventId,
      assetType,
      dto.storageKey,
      dto.fileSize ? BigInt(dto.fileSize) : null,
      dto.mimeType ?? null,
    )
    return this.commandBus.execute(command)
  }

  @Roles('admin')
  @Delete(':assetType')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an event asset' })
  @ApiParam({ name: 'eventId', description: 'Event UUID', format: 'uuid' })
  @ApiParam({
    name: 'assetType',
    description: 'Asset type',
    enum: ['cover_image', 'event_logo', 'hero_image', 'poster'],
  })
  @ApiEnvelopeErrorResponse({ status: 404, description: 'Asset not found' })
  async deleteAsset(
    @Param('eventId') eventId: string,
    @Param('assetType') assetType: EventAssetType,
  ) {
    await this.commandBus.execute(new DeleteEventAssetCommand(eventId, assetType))
  }
}
