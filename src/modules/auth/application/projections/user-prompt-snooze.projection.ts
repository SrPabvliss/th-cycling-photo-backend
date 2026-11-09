export class UserPromptSnoozeProjection {
  /** Snooze row UUID */
  id: string
  /** Owning user UUID */
  userId: string
  /** Prompt this snooze applies to, e.g. 'email_verification' */
  promptKey: string
  /** The prompt stays hidden until this instant */
  snoozedUntil: Date
  /** When the snooze was recorded */
  createdAt: Date
}
