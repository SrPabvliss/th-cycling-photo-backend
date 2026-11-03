export const CONSENT_TYPE = {
  TERMS_PRIVACY: 'terms_privacy',
  GUARDIAN: 'guardian',
  TERMS_TENANT: 'terms_tenant',
  ELECTRONIC_INVOICE: 'electronic_invoice',
} as const

export type ConsentType = (typeof CONSENT_TYPE)[keyof typeof CONSENT_TYPE]

export const POLICY_VERSIONS: Record<ConsentType, string> = {
  [CONSENT_TYPE.TERMS_PRIVACY]: '2026-08-16',
  [CONSENT_TYPE.GUARDIAN]: '2026-08-16',
  [CONSENT_TYPE.TERMS_TENANT]: '2026-08-23',
  [CONSENT_TYPE.ELECTRONIC_INVOICE]: '2026-11-02',
}

export const REQUIRED_CONSENT_TYPES: ConsentType[] = [CONSENT_TYPE.TERMS_PRIVACY]
