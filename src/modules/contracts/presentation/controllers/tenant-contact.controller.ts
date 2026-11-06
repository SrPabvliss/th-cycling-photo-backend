import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CurrentUser, type ICurrentUser } from '@shared/auth'
import { RequirePermission } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import { ApiEnvelopeErrorResponse, SuccessMessage } from '@shared/http'
import { SendContactRequestCommand } from '../../application/commands/send-contact-request/send-contact-request.command'
import { SendContactRequestDto } from '../../application/commands/send-contact-request/send-contact-request.dto'

@ApiTags('Contracts')
@ApiBearerAuth()
@Controller('tenants/me')
export class TenantContactController {
  constructor(private readonly commandBus: CommandBus) {}

  @Throttle({ short: { limit: 3, ttl: 3_600_000 } })
  @RequirePermission('tenant.profile.read')
  @Post('contact-requests')
  @HttpCode(HttpStatus.CREATED)
  @SuccessMessage('contract.contact_request_sent')
  @ApiOperation({ summary: 'Send a quota or renewal request from the organizer to Titan TV' })
  @ApiEnvelopeErrorResponse({ status: 403, description: 'The user is not a tenant member' })
  @ApiEnvelopeErrorResponse({ status: 429, description: 'Too many contact requests' })
  async send(@Body() dto: SendContactRequestDto, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(
      new SendContactRequestCommand(user.userId, dto.reason, dto.eventsWanted ?? null, dto.message),
    )
  }
}
