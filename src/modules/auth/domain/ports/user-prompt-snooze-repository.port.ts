import type { UserPromptSnoozeProjection } from '../../application/projections'

export interface IUserPromptSnoozeRepository {
  snooze(userId: string, promptKey: string, until: Date): Promise<void>
  findByUser(userId: string): Promise<UserPromptSnoozeProjection[]>
  lastSnoozedAt(userId: string): Promise<Date | null>
}

export const USER_PROMPT_SNOOZE_REPOSITORY = Symbol('USER_PROMPT_SNOOZE_REPOSITORY')
