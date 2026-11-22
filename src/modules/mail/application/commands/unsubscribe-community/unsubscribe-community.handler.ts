import { RevokeConsentsCommand } from '@auth/application/commands/revoke-consents/revoke-consents.command'
import { CONSENT_TYPE } from '@auth/domain/constants/consent.constants'
import { Inject } from '@nestjs/common'
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { type IUnsubscribeTokenService, UNSUBSCRIBE_TOKEN_SERVICE } from '../../../domain/community'
import { UnsubscribeCommunityCommand } from './unsubscribe-community.command'

/** The unsubscribe link of a community email: no session, the signed token names the user. */
@CommandHandler(UnsubscribeCommunityCommand)
export class UnsubscribeCommunityHandler implements ICommandHandler<UnsubscribeCommunityCommand> {
  constructor(
    @Inject(UNSUBSCRIBE_TOKEN_SERVICE) private readonly tokens: IUnsubscribeTokenService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: UnsubscribeCommunityCommand): Promise<{ unsubscribed: true }> {
    const userId = this.tokens.verify(command.token ?? '')
    if (!userId) throw AppException.businessRule('mail.unsubscribe_link_invalid')
    await this.commandBus.execute(
      new RevokeConsentsCommand(userId, [CONSENT_TYPE.COMMUNITY_EMAILS]),
    )
    return { unsubscribed: true }
  }
}
