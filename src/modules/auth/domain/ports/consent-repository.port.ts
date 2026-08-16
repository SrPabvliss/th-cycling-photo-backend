import type { ConsentType } from '../constants/consent.constants'
import type { RecordConsentPayload } from '../payloads'

export interface IConsentRepository {
  record(payload: RecordConsentPayload): Promise<void>
  findAcceptedTypes(userId: string, policyVersion: string): Promise<ConsentType[]>
}

export const CONSENT_REPOSITORY = Symbol('CONSENT_REPOSITORY')
