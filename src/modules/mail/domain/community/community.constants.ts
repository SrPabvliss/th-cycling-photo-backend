export const COMMUNITY_CAMPAIGN = {
  BIRTHDAY: 'birthday',
  CHRISTMAS: 'christmas',
  NEW_YEAR: 'new-year',
} as const

export type CommunityCampaign = (typeof COMMUNITY_CAMPAIGN)[keyof typeof COMMUNITY_CAMPAIGN]

export const COMMUNITY_CAMPAIGNS: CommunityCampaign[] = Object.values(COMMUNITY_CAMPAIGN)

export const COMMUNITY_TIME_ZONE = 'America/Guayaquil'

/** When each campaign goes out, in Ecuador time. */
export const COMMUNITY_SCHEDULES: Record<CommunityCampaign, string> = {
  birthday: '0 9 * * *',
  christmas: '0 9 24 12 *',
  'new-year': '0 10 1 1 *',
}

/** The key a send is recorded under carries the year, so each campaign reaches a person once a year. */
export const communityCampaignKey = (campaign: CommunityCampaign, today: string): string =>
  `${campaign}-${today.slice(0, 4)}`

/** Path of the front page the unsubscribe link in each email opens. */
export const UNSUBSCRIBE_PAGE_PATH = '/email/unsubscribe'
