import { Body, Controller, HttpCode, Post, Query } from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CurrentUser, type ICurrentUser, Public } from '@shared/auth'
import { RequirePermission } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import { ApiEnvelopeErrorResponse } from '@shared/http'
import { SendCommunityTestCommand } from '../../application/commands/send-community-test/send-community-test.command'
import { SendCommunityTestDto } from '../../application/commands/send-community-test/send-community-test.dto'
import { UnsubscribeCommunityCommand } from '../../application/commands/unsubscribe-community/unsubscribe-community.command'

@ApiTags('Mail')
@Controller('mail')
export class MailController {
  constructor(private readonly commandBus: CommandBus) {}

  /**
   * Target of the unsubscribe link and of the one-click `List-Unsubscribe-Post` header (RFC 8058):
   * a POST, never a GET, so mail scanners that open links do not unsubscribe anyone.
   */
  @Public()
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @Post('unsubscribe')
  @HttpCode(200)
  @ApiOperation({ summary: 'Turn community emails off from the link in an email (no session)' })
  @ApiQuery({ name: 'token', description: 'Signed token from the email link' })
  @ApiEnvelopeErrorResponse({ status: 422, description: 'The link is not valid' })
  async unsubscribe(@Query('token') token: string) {
    return this.commandBus.execute(new UnsubscribeCommunityCommand(token))
  }

  @RequirePermission('user.update')
  @Post('community/test')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a community email to yourself, marked as a test' })
  async sendCommunityTest(@Body() dto: SendCommunityTestDto, @CurrentUser() user: ICurrentUser) {
    return this.commandBus.execute(new SendCommunityTestCommand(user.userId, dto.campaign))
  }
}
