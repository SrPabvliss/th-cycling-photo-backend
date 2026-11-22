export const CONSENT_TYPE = {
  TERMS_PRIVACY: 'terms_privacy',
  GUARDIAN: 'guardian',
  TERMS_TENANT: 'terms_tenant',
  ELECTRONIC_INVOICE: 'electronic_invoice',
  COMMUNITY_EMAILS: 'community_emails',
} as const

export type ConsentType = (typeof CONSENT_TYPE)[keyof typeof CONSENT_TYPE]

export const POLICY_VERSIONS: Record<ConsentType, string> = {
  [CONSENT_TYPE.TERMS_PRIVACY]: '2026-08-16',
  [CONSENT_TYPE.GUARDIAN]: '2026-08-16',
  [CONSENT_TYPE.TERMS_TENANT]: '2026-08-23',
  [CONSENT_TYPE.ELECTRONIC_INVOICE]: '2026-11-02',
  [CONSENT_TYPE.COMMUNITY_EMAILS]: '2026-11-22',
}

export const REQUIRED_CONSENT_TYPES: ConsentType[] = [CONSENT_TYPE.TERMS_PRIVACY]

/** Consents a user may withdraw on their own. The legal ones go with the account. */
export const REVOCABLE_CONSENT_TYPES: ConsentType[] = [CONSENT_TYPE.COMMUNITY_EMAILS]
