import type { ConsentType } from '../constants/consent.constants'

export interface RecordConsentPayload {
  userId: string
  type: ConsentType
  policyVersion: string
  ipAddress?: string | null
  userAgent?: string | null
}
