import type { IUserPromptSnoozeRepository } from '../../../domain/ports'
import { SnoozePromptCommand } from './snooze-prompt.command'
import { SnoozePromptHandler } from './snooze-prompt.handler'

describe('SnoozePromptHandler', () => {
  let handler: SnoozePromptHandler
  let promptSnoozeRepo: jest.Mocked<IUserPromptSnoozeRepository>

  beforeEach(() => {
    promptSnoozeRepo = {
      snooze: jest.fn().mockResolvedValue(undefined),
      findByUser: jest.fn(),
      lastSnoozedAt: jest.fn(),
    } as jest.Mocked<IUserPromptSnoozeRepository>

    handler = new SnoozePromptHandler(promptSnoozeRepo)
  })

  it('snoozes a known prompt key for 7 days', async () => {
    const before = Date.now()

    await handler.execute(new SnoozePromptCommand('user-1', 'email_verification'))

    expect(promptSnoozeRepo.snooze).toHaveBeenCalledTimes(1)
    const [userId, promptKey, until] = promptSnoozeRepo.snooze.mock.calls[0]
    expect(userId).toBe('user-1')
    expect(promptKey).toBe('email_verification')

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    expect(until.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000)
    expect(until.getTime()).toBeLessThanOrEqual(Date.now() + sevenDaysMs + 1000)
  })

  it('rejects an unknown prompt key without touching the repository', async () => {
    await expect(
      handler.execute(new SnoozePromptCommand('user-1', 'whatsapp_verification')),
    ).rejects.toThrow(/auth.prompt_key_unknown/)

    expect(promptSnoozeRepo.snooze).not.toHaveBeenCalled()
  })
})
