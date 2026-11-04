import type { RikuchiyAnnulmentPayload } from '../rikuchiy-annulment'
import type { RikuchiyEmissionPayload, SriIdType } from '../rikuchiy-emission-payload'
import type { CachedTaxDocument } from './order-tax-document-repository.port'

export interface IdentificationCheck {
  valid: boolean
  reason: string | null
}

export type EmissionOutcome =
  | { kind: 'accepted'; taxDocumentId: string }
  | { kind: 'rejected'; reason: string; message: string }
  | { kind: 'retry'; reason: string }

export type AnnulmentResult =
  | {
      kind: 'accepted'
      outcome: 'cancelled' | 'credit_note' | 'pending' | 'stands'
      creditNoteId: string | null
    }
  | { kind: 'rejected'; reason: string; message: string }
  | { kind: 'retry'; reason: string }

export interface SignedFile {
  url: string
  expiresAt: string
}

export type DocumentFilesResult =
  | { kind: 'files'; xml: SignedFile; pdf: SignedFile }
  | { kind: 'not_stored' }
  | { kind: 'unavailable' }

export type ResendResult = 'accepted' | 'not_resendable' | 'unavailable'

export interface ResendRequester {
  id: string
  name: string
}

export interface IRikuchiyClient {
  isConfigured(): boolean
  validateIdentification(idType: SriIdType, idNumber: string): Promise<IdentificationCheck | null>
  emit(payload: RikuchiyEmissionPayload): Promise<EmissionOutcome>
  annul(externalRef: string, payload: RikuchiyAnnulmentPayload): Promise<AnnulmentResult>
  getSaleDocuments(externalRef: string): Promise<CachedTaxDocument[] | null>
  getDocumentFiles(taxDocumentId: string): Promise<DocumentFilesResult>
  resend(taxDocumentId: string, requestedBy: ResendRequester): Promise<ResendResult>
}

export const RIKUCHIY_CLIENT = Symbol('RIKUCHIY_CLIENT')
