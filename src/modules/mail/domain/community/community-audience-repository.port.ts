import type { CommunityCampaign } from './community.constants'

export interface CommunityRecipient {
  userId: string
  email: string
  firstName: string | null
}

export interface ICommunityAudienceRepository {
  /** Active adults with community emails on who should get the campaign on that Ecuador day. */
  findAudience(campaign: CommunityCampaign, today: string): Promise<string[]>
  /** The recipient while they can still receive community emails; null once they cannot. */
  findEligible(userId: string, today: string): Promise<CommunityRecipient | null>
  /** Any user, consent or not: for test sends to staff. */
  findUser(userId: string): Promise<CommunityRecipient | null>
  hasSent(userId: string, campaignKey: string): Promise<boolean>
  recordSent(userId: string, campaignKey: string): Promise<void>
}

export const COMMUNITY_AUDIENCE_REPOSITORY = Symbol('COMMUNITY_AUDIENCE_REPOSITORY')
