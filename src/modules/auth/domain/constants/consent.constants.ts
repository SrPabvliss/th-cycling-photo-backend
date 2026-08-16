export const POLICY_VERSION = '2026-08-16'

export const CONSENT_TYPE = {
  TERMS_PRIVACY: 'terms_privacy',
  GUARDIAN: 'guardian',
} as const

export type ConsentType = (typeof CONSENT_TYPE)[keyof typeof CONSENT_TYPE]

export const REQUIRED_CONSENT_TYPES: ConsentType[] = [CONSENT_TYPE.TERMS_PRIVACY]
