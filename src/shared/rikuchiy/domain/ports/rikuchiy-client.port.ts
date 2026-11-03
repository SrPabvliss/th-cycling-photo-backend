import type { RikuchiyEmissionPayload, SriIdType } from '../rikuchiy-emission-payload'

export interface IdentificationCheck {
  valid: boolean
  reason: string | null
}

export type EmissionOutcome =
  | { kind: 'accepted'; taxDocumentId: string }
  | { kind: 'rejected'; reason: string }
  | { kind: 'retry'; reason: string }

export interface IRikuchiyClient {
  isConfigured(): boolean
  validateIdentification(idType: SriIdType, idNumber: string): Promise<IdentificationCheck | null>
  emit(payload: RikuchiyEmissionPayload): Promise<EmissionOutcome>
}

export const RIKUCHIY_CLIENT = Symbol('RIKUCHIY_CLIENT')
