import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { CommunityEmailService } from '../../application/services/community-email.service'
import {
  COMMUNITY_AUDIENCE_REPOSITORY,
  communityCampaignKey,
  type ICommunityAudienceRepository,
} from '../../domain/community'
import {
  COMMUNITY_EMAIL_DELIVERY_QUEUE,
  type CommunityEmailJobData,
} from './community-campaign.processor'

/** Spread over time: 20 a minute keeps a campaign from spending the day's sending quota at once. */
const PER_MINUTE = 20

@Processor(COMMUNITY_EMAIL_DELIVERY_QUEUE, {
  concurrency: 1,
  limiter: { max: PER_MINUTE, duration: 60_000 },
})
export class CommunityEmailDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(CommunityEmailDeliveryProcessor.name)

  constructor(
    @Inject(COMMUNITY_AUDIENCE_REPOSITORY)
    private readonly audience: ICommunityAudienceRepository,
    private readonly communityEmail: CommunityEmailService,
  ) {
    super()
  }

  async process(job: Job<CommunityEmailJobData>): Promise<void> {
    const { userId, campaign, today } = job.data
    const key = communityCampaignKey(campaign, today)

    if (await this.audience.hasSent(userId, key)) return
    // Checked again at send time: someone may have unsubscribed after the fan-out.
    const recipient = await this.audience.findEligible(userId, today)
    if (!recipient) return

    await this.communityEmail.send(recipient, campaign, today)
    await this.audience.recordSent(userId, key)
    this.logger.log(`Sent ${key} to user ${userId}`)
  }
}
