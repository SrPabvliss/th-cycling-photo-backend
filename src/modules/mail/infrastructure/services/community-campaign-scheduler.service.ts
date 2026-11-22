import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Queue } from 'bullmq'
import {
  COMMUNITY_CAMPAIGNS,
  COMMUNITY_SCHEDULES,
  COMMUNITY_TIME_ZONE,
} from '../../domain/community'
import {
  COMMUNITY_CAMPAIGNS_QUEUE,
  type CommunityCampaignJobData,
} from '../processors/community-campaign.processor'

export const communitySchedulerId = (campaign: string): string => `community-${campaign}`

@Injectable()
export class CommunityCampaignSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(CommunityCampaignSchedulerService.name)
  private readonly enabled: boolean

  constructor(
    @InjectQueue(COMMUNITY_CAMPAIGNS_QUEUE) private readonly queue: Queue,
    config: ConfigService,
  ) {
    this.enabled = config.get<boolean>('mail.communityEmailsEnabled', true)
  }

  async onModuleInit(): Promise<void> {
    for (const campaign of COMMUNITY_CAMPAIGNS) {
      const id = communitySchedulerId(campaign)
      if (!this.enabled) {
        await this.queue.removeJobScheduler(id)
        continue
      }
      await this.queue.upsertJobScheduler(
        id,
        { pattern: COMMUNITY_SCHEDULES[campaign], tz: COMMUNITY_TIME_ZONE },
        {
          name: campaign,
          data: { campaign } satisfies CommunityCampaignJobData,
          opts: { removeOnComplete: true, removeOnFail: { age: 7 * 24 * 3600 } },
        },
      )
    }
    this.logger.log(
      this.enabled ? 'Community email campaigns scheduled' : 'Community email campaigns are off',
    )
  }
}
