import { CONSENT_TYPE } from '@auth/domain/constants/consent.constants'
import { Injectable } from '@nestjs/common'
import { isBirthdayOn, isMinorOn } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import {
  COMMUNITY_CAMPAIGN,
  type CommunityCampaign,
  type CommunityRecipient,
  type ICommunityAudienceRepository,
} from '../../domain/community'

/** Any active (not revoked) community emails consent, whatever policy version it was given under. */
const WITH_COMMUNITY_EMAILS = {
  consents: { some: { type: CONSENT_TYPE.COMMUNITY_EMAILS, revoked_at: null } },
}

const RECIPIENT_SELECT = {
  id: true,
  email: true,
  first_name: true,
  customer_profile: { select: { birth_date: true } },
} as const

@Injectable()
export class CommunityAudienceRepository implements ICommunityAudienceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAudience(campaign: CommunityCampaign, today: string): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { is_active: true, ...WITH_COMMUNITY_EMAILS },
      select: { id: true, customer_profile: { select: { birth_date: true } } },
    })
    return users
      .filter((user) => {
        const birthDate = user.customer_profile?.birth_date ?? null
        if (isMinorOn(birthDate, today)) return false
        if (campaign !== COMMUNITY_CAMPAIGN.BIRTHDAY) return true
        return birthDate !== null && isBirthdayOn(birthDate, today)
      })
      .map((user) => user.id)
  }

  async findEligible(userId: string, today: string): Promise<CommunityRecipient | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, is_active: true, ...WITH_COMMUNITY_EMAILS },
      select: RECIPIENT_SELECT,
    })
    if (!user || isMinorOn(user.customer_profile?.birth_date ?? null, today)) return null
    return { userId: user.id, email: user.email, firstName: user.first_name }
  }

  async findUser(userId: string): Promise<CommunityRecipient | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: RECIPIENT_SELECT,
    })
    return user ? { userId: user.id, email: user.email, firstName: user.first_name } : null
  }

  async hasSent(userId: string, campaignKey: string): Promise<boolean> {
    const row = await this.prisma.communityEmailSend.findUnique({
      where: { user_id_campaign: { user_id: userId, campaign: campaignKey } },
      select: { id: true },
    })
    return row !== null
  }

  async recordSent(userId: string, campaignKey: string): Promise<void> {
    await this.prisma.communityEmailSend.upsert({
      where: { user_id_campaign: { user_id: userId, campaign: campaignKey } },
      create: { user_id: userId, campaign: campaignKey },
      update: {},
    })
  }
}
