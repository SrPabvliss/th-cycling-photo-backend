import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Logger } from '@nestjs/common'
import { toEcuadorDateOnly } from '@shared/domain'
import type { Job, Queue } from 'bullmq'
import {
  COMMUNITY_AUDIENCE_REPOSITORY,
  type CommunityCampaign,
  communityCampaignKey,
  type ICommunityAudienceRepository,
} from '../../domain/community'

export const COMMUNITY_CAMPAIGNS_QUEUE = 'community-campaigns'
export const COMMUNITY_EMAIL_DELIVERY_QUEUE = 'community-email-delivery'

export interface CommunityCampaignJobData {
  campaign: CommunityCampaign
}

export interface CommunityEmailJobData {
  userId: string
  campaign: CommunityCampaign
  today: string
}

/** Fans a scheduled campaign out into one delivery job per recipient. */
@Processor(COMMUNITY_CAMPAIGNS_QUEUE)
export class CommunityCampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CommunityCampaignProcessor.name)

  constructor(
    @Inject(COMMUNITY_AUDIENCE_REPOSITORY)
    private readonly audience: ICommunityAudienceRepository,
    @InjectQueue(COMMUNITY_EMAIL_DELIVERY_QUEUE) private readonly deliveryQueue: Queue,
  ) {
    super()
  }

  async process(job: Job<CommunityCampaignJobData>): Promise<void> {
    const { campaign } = job.data
    const today = toEcuadorDateOnly(new Date())
    const key = communityCampaignKey(campaign, today)
    const userIds = await this.audience.findAudience(campaign, today)

    // The job id is the campaign key plus the user: a second fan-out (a retry, a redeploy at
    // send time) adds nothing for anyone already queued. The send log covers the rest.
    await this.deliveryQueue.addBulk(
      userIds.map((userId) => ({
        name: 'send',
        data: { userId, campaign, today } satisfies CommunityEmailJobData,
        opts: {
          jobId: `${key}_${userId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: { age: 7 * 24 * 3600 },
          removeOnFail: { age: 30 * 24 * 3600 },
        },
      })),
    )
    this.logger.log(`Queued ${key} for ${userIds.length} recipient(s)`)
  }
}
