import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type {
  AnnulmentResult,
  CachedTaxDocument,
  DocumentFilesResult,
  EmissionOutcome,
  IdentificationCheck,
  IRikuchiyClient,
  ResendRequester,
  ResendResult,
} from '../../domain/ports'
import type { RikuchiyAnnulmentPayload } from '../../domain/rikuchiy-annulment'
import { RikuchiyEmission } from '../../domain/rikuchiy-emission'
import type { RikuchiyEmissionPayload, SriIdType } from '../../domain/rikuchiy-emission-payload'

interface RikuchiyAnswer {
  status: number
  body: {
    data?: unknown
    error?: { code?: string; message?: string }
  } | null
}

@Injectable()
export class RikuchiyHttpClient implements IRikuchiyClient {
  private static readonly REJECTED_STATUSES = new Set([400, 409, 422])
  private static readonly ANNULMENT_REJECTED_STATUSES = new Set([400, 422])
  private static readonly NOT_CONFIGURED = 'rikuchiy is not configured'

  private readonly logger = new Logger(RikuchiyHttpClient.name)
  private readonly baseUrl: string
  private readonly serviceKey: string
  private readonly timeoutMs: number
  private readonly redirectTo: string

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('rikuchiy.baseUrl', '') ?? '').replace(/\/+$/, '')
    this.serviceKey = config.get<string>('rikuchiy.serviceKey', '') ?? ''
    this.timeoutMs = config.get<number>('rikuchiy.timeoutMs', 5000) ?? 5000
    this.redirectTo = config.get<string>('mail.redirectTo', '') ?? ''
  }

  isConfigured(): boolean {
    return this.baseUrl !== '' && this.serviceKey !== ''
  }

  async validateIdentification(
    idType: SriIdType,
    idNumber: string,
  ): Promise<IdentificationCheck | null> {
    if (!this.isConfigured()) return null

    const answer = await this.post('/identifications/validation', {
      idType,
      idNumber,
    })
    if (answer instanceof Error || answer.status !== 200) return null

    const data = answer.body?.data as IdentificationCheck | undefined
    return data ? { valid: data.valid, reason: data.reason ?? null } : null
  }

  async emit(payload: RikuchiyEmissionPayload): Promise<EmissionOutcome> {
    const answer = await this.post('/emissions', this.redirected(payload))
    if (answer instanceof Error) return { kind: 'retry', reason: answer.message }

    if (answer.status === 202 || answer.status === 200) {
      const data = answer.body?.data as { id?: string } | undefined
      if (data?.id) return { kind: 'accepted', taxDocumentId: data.id }
      return {
        kind: 'retry',
        reason: `${answer.status} without a tax document id`,
      }
    }

    const reason = RikuchiyHttpClient.reasonOf(answer)
    if (RikuchiyHttpClient.REJECTED_STATUSES.has(answer.status)) {
      return { kind: 'rejected', reason, message: RikuchiyHttpClient.messageOf(answer, reason) }
    }
    return { kind: 'retry', reason }
  }

  async annul(externalRef: string, payload: RikuchiyAnnulmentPayload): Promise<AnnulmentResult> {
    if (!this.isConfigured()) return { kind: 'retry', reason: RikuchiyHttpClient.NOT_CONFIGURED }

    const path = `/sales/${RikuchiyEmission.APP}/${encodeURIComponent(externalRef)}/annulment`
    const answer = await this.post(path, payload)
    if (answer instanceof Error) return { kind: 'retry', reason: answer.message }

    if (answer.status === 202 || answer.status === 200) {
      const data = answer.body?.data as { outcome?: string; id?: string } | undefined
      const outcome = data?.outcome
      if (
        outcome === 'cancelled' ||
        outcome === 'credit_note' ||
        outcome === 'pending' ||
        outcome === 'stands'
      ) {
        return { kind: 'accepted', outcome, creditNoteId: data?.id ?? null }
      }
      return {
        kind: 'retry',
        reason: `${answer.status} without a known outcome`,
      }
    }

    const reason = RikuchiyHttpClient.reasonOf(answer)
    if (RikuchiyHttpClient.ANNULMENT_REJECTED_STATUSES.has(answer.status)) {
      return { kind: 'rejected', reason, message: RikuchiyHttpClient.messageOf(answer, reason) }
    }
    return { kind: 'retry', reason }
  }

  async getSaleDocuments(externalRef: string): Promise<CachedTaxDocument[] | null> {
    if (!this.isConfigured()) return null

    const path = `/sales/${RikuchiyEmission.APP}/${encodeURIComponent(externalRef)}/tax-documents`
    const answer = await this.get(path)
    if (answer instanceof Error || answer.status !== 200) return null

    const data = answer.body?.data
    if (!Array.isArray(data)) return null

    return data.map((entry) => ({
      id: entry.id,
      externalRef,
      type: entry.type,
      state: entry.state,
      number: entry.number,
      accessKey: entry.accessKey,
      issueDate: entry.issueDate,
      authorizedAt: entry.authorizedAt ? new Date(entry.authorizedAt) : null,
      sriMessages: entry.sriMessages ?? [],
      deliveries: entry.deliveries ?? [],
      syncedAt: null,
    }))
  }

  async getDocumentFiles(taxDocumentId: string): Promise<DocumentFilesResult> {
    if (!this.isConfigured()) return { kind: 'unavailable' }

    const answer = await this.get(`/tax-documents/${encodeURIComponent(taxDocumentId)}/files`)
    if (answer instanceof Error) return { kind: 'unavailable' }
    if (answer.status === 409) return { kind: 'not_stored' }

    const data = answer.body?.data as
      | { xml?: { url: string; expiresAt: string }; pdf?: { url: string; expiresAt: string } }
      | undefined
    if (answer.status !== 200 || !data?.xml || !data.pdf) return { kind: 'unavailable' }
    return { kind: 'files', xml: data.xml, pdf: data.pdf }
  }

  async resend(taxDocumentId: string, requestedBy: ResendRequester): Promise<ResendResult> {
    if (!this.isConfigured()) return 'unavailable'

    const answer = await this.post(`/tax-documents/${encodeURIComponent(taxDocumentId)}/resends`, {
      requestedBy: { kind: 'operator', id: requestedBy.id, name: requestedBy.name },
      email: null,
    })
    if (answer instanceof Error) return 'unavailable'
    if (answer.status === 202) return 'accepted'
    if (answer.status === 409) return 'not_resendable'
    return 'unavailable'
  }

  private redirected(payload: RikuchiyEmissionPayload): RikuchiyEmissionPayload {
    if (this.redirectTo === '') return payload
    return { ...payload, buyer: { ...payload.buyer, email: this.redirectTo } }
  }

  private static reasonOf(answer: RikuchiyAnswer): string {
    const error = answer.body?.error
    return `${answer.status} ${error?.code ?? 'UNKNOWN'}: ${error?.message ?? 'no message'}`
  }

  private static messageOf(answer: RikuchiyAnswer, reason: string): string {
    return answer.body?.error?.message ?? reason
  }

  private async get(path: string): Promise<RikuchiyAnswer | Error> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.serviceKey}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error))
      this.logger.warn(`rikuchiy did not answer GET ${path}: ${cause.message}`)
      return cause
    }

    const parsed = (await response.json().catch(() => null)) as RikuchiyAnswer['body']
    return { status: response.status, body: parsed }
  }

  private async post(path: string, body: object): Promise<RikuchiyAnswer | Error> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error))
      this.logger.warn(`rikuchiy did not answer POST ${path}: ${cause.message}`)
      return cause
    }

    const parsed = (await response.json().catch(() => null)) as RikuchiyAnswer['body']
    return { status: response.status, body: parsed }
  }
}
