export const PROMPT_KEY = {
  EMAIL_VERIFICATION: 'email_verification',
  PERSONAL_PROFILE: 'personal_profile',
} as const

export type PromptKey = (typeof PROMPT_KEY)[keyof typeof PROMPT_KEY]

export const PROMPT_PRIORITY: PromptKey[] = [
  PROMPT_KEY.EMAIL_VERIFICATION,
  PROMPT_KEY.PERSONAL_PROFILE,
]

export const PROMPT_GLOBAL_COOLDOWN_MS = 24 * 60 * 60 * 1000

export const PROMPT_SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000
