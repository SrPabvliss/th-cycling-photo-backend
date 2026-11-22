import type { ConsentType } from '../constants/consent.constants'
import type { RecordConsentPayload } from '../payloads'

export interface ActiveConsent {
  acceptedAt: Date
  ip: string | null
}

export interface IConsentRepository {
  record(payload: RecordConsentPayload): Promise<void>
  findAcceptedTypes(userId: string, policyVersion: string): Promise<ConsentType[]>
  findActive(userId: string, type: ConsentType): Promise<ActiveConsent | null>
  /** Marks every active consent of that type as revoked. */
  revoke(userId: string, type: ConsentType): Promise<void>
}

export const CONSENT_REPOSITORY = Symbol('CONSENT_REPOSITORY')
