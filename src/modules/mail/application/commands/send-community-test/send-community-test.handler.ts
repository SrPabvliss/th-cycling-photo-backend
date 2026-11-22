import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException, toEcuadorDateOnly } from '@shared/domain'
import {
  COMMUNITY_AUDIENCE_REPOSITORY,
  type ICommunityAudienceRepository,
} from '../../../domain/community'
import { CommunityEmailService } from '../../services/community-email.service'
import { SendCommunityTestCommand } from './send-community-test.command'

/** Sends the real campaign email to the staff member who asks, marked as a test and not logged. */
@CommandHandler(SendCommunityTestCommand)
export class SendCommunityTestHandler implements ICommandHandler<SendCommunityTestCommand> {
  constructor(
    @Inject(COMMUNITY_AUDIENCE_REPOSITORY)
    private readonly audience: ICommunityAudienceRepository,
    private readonly communityEmail: CommunityEmailService,
  ) {}

  async execute(command: SendCommunityTestCommand): Promise<{ sentTo: string }> {
    const recipient = await this.audience.findUser(command.userId)
    if (!recipient) throw AppException.notFound('entities.user', command.userId)
    await this.communityEmail.send(recipient, command.campaign, toEcuadorDateOnly(new Date()), {
      test: true,
    })
    return { sentTo: recipient.email }
  }
}
