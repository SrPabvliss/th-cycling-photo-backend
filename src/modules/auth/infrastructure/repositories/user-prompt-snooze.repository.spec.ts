import type { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import { UserPromptSnoozeRepository } from './user-prompt-snooze.repository'

describe('UserPromptSnoozeRepository.snooze', () => {
  let prisma: any
  let repo: UserPromptSnoozeRepository

  beforeEach(() => {
    prisma = {
      userPromptSnooze: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    }
    repo = new UserPromptSnoozeRepository(prisma as PrismaService)
  })

  it('refreshes created_at on the update branch so the global cooldown keeps rolling', async () => {
    const until = new Date(Date.now() + 24 * 60 * 60_000)
    const before = Date.now()

    await repo.snooze('user-1', 'ai-processing', until)

    const call = prisma.userPromptSnooze.upsert.mock.calls[0][0]
    expect(call.where).toEqual({
      user_id_prompt_key: { user_id: 'user-1', prompt_key: 'ai-processing' },
    })
    expect(call.update.snoozed_until).toBe(until)
    expect(call.update.created_at).toBeInstanceOf(Date)
    expect(call.update.created_at.getTime()).toBeGreaterThanOrEqual(before)
    expect(call.create).toEqual({
      user_id: 'user-1',
      prompt_key: 'ai-processing',
      snoozed_until: until,
    })
  })
})
