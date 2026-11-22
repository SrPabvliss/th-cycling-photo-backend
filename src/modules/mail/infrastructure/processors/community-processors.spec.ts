import type { Job, Queue } from 'bullmq'
import type { CommunityEmailService } from '../../application/services/community-email.service'
import type { ICommunityAudienceRepository } from '../../domain/community'
import {
  type CommunityCampaignJobData,
  CommunityCampaignProcessor,
  type CommunityEmailJobData,
} from './community-campaign.processor'
import { CommunityEmailDeliveryProcessor } from './community-email-delivery.processor'

const audienceRepo = (): jest.Mocked<ICommunityAudienceRepository> => ({
  findAudience: jest.fn().mockResolvedValue(['u1', 'u2']),
  findEligible: jest
    .fn()
    .mockResolvedValue({ userId: 'u1', email: 'u1@example.com', firstName: 'Ana' }),
  findUser: jest.fn(),
  hasSent: jest.fn().mockResolvedValue(false),
  recordSent: jest.fn().mockResolvedValue(undefined),
})

describe('CommunityCampaignProcessor', () => {
  it('queues one delivery per recipient, keyed by campaign, year and user', async () => {
    const audience = audienceRepo()
    const queue = { addBulk: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<Queue>
    jest.useFakeTimers({ now: Date.parse('2026-12-24T14:00:00Z') })

    await new CommunityCampaignProcessor(audience, queue).process({
      data: { campaign: 'christmas' },
    } as Job<CommunityCampaignJobData>)

    jest.useRealTimers()
    expect(audience.findAudience).toHaveBeenCalledWith('christmas', '2026-12-24')
    const jobs = (queue.addBulk as jest.Mock).mock.calls[0][0]
    expect(jobs.map((j: { opts: { jobId: string } }) => j.opts.jobId)).toEqual([
      'christmas-2026_u1',
      'christmas-2026_u2',
    ])
    expect(jobs[0].data).toEqual({ userId: 'u1', campaign: 'christmas', today: '2026-12-24' })
  })
})

describe('CommunityEmailDeliveryProcessor', () => {
  const job = {
    data: { userId: 'u1', campaign: 'christmas', today: '2026-12-24' },
  } as Job<CommunityEmailJobData>

  it('sends and records the send', async () => {
    const audience = audienceRepo()
    const email = {
      send: jest.fn().mockResolvedValue(undefined),
    } as unknown as CommunityEmailService

    await new CommunityEmailDeliveryProcessor(audience, email).process(job)

    expect(email.send).toHaveBeenCalledWith(
      { userId: 'u1', email: 'u1@example.com', firstName: 'Ana' },
      'christmas',
      '2026-12-24',
    )
    expect(audience.recordSent).toHaveBeenCalledWith('u1', 'christmas-2026')
  })

  it('never sends the same campaign twice to a person', async () => {
    const audience = audienceRepo()
    audience.hasSent.mockResolvedValue(true)
    const email = { send: jest.fn() } as unknown as CommunityEmailService

    await new CommunityEmailDeliveryProcessor(audience, email).process(job)

    expect(email.send).not.toHaveBeenCalled()
  })

  it('skips someone who unsubscribed after the fan-out', async () => {
    const audience = audienceRepo()
    audience.findEligible.mockResolvedValue(null)
    const email = { send: jest.fn() } as unknown as CommunityEmailService

    await new CommunityEmailDeliveryProcessor(audience, email).process(job)

    expect(email.send).not.toHaveBeenCalled()
    expect(audience.recordSent).not.toHaveBeenCalled()
  })
})
