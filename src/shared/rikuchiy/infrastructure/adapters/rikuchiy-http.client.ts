import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { EmissionOutcome, IdentificationCheck, IRikuchiyClient } from '../../domain/ports'
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

    const answer = await this.post('/identifications/validation', { idType, idNumber })
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
      return { kind: 'retry', reason: `${answer.status} without a tax document id` }
    }

    const reason = RikuchiyHttpClient.reasonOf(answer)
    if (RikuchiyHttpClient.REJECTED_STATUSES.has(answer.status)) return { kind: 'rejected', reason }
    return { kind: 'retry', reason }
  }

  private redirected(payload: RikuchiyEmissionPayload): RikuchiyEmissionPayload {
    if (this.redirectTo === '') return payload
    return { ...payload, buyer: { ...payload.buyer, email: this.redirectTo } }
  }

  private static reasonOf(answer: RikuchiyAnswer): string {
    const error = answer.body?.error
    return `${answer.status} ${error?.code ?? 'UNKNOWN'}: ${error?.message ?? 'no message'}`
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
