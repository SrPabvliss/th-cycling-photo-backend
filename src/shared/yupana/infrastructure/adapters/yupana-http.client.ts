import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain'
import type { IYupanaClient, YupanaItemResult, YupanaOutcome } from '../../domain/ports'

interface ReportResultBody {
  sourceReportId: string | null
  outcome: YupanaOutcome
  reason: string | null
}

interface DeclarationResultBody {
  photoId: string | null
  declaredAt: string | null
  outcome: YupanaOutcome
  reason: string | null
}

@Injectable()
export class YupanaHttpClient implements IYupanaClient {
  private readonly logger = new Logger(YupanaHttpClient.name)
  private readonly baseUrl: string
  private readonly producerKey: string
  private readonly serviceKey: string
  private readonly timeoutMs: number

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('yupana.baseUrl', '') ?? '').replace(/\/+$/, '')
    this.producerKey = config.get<string>('yupana.producerKey', '') ?? ''
    this.serviceKey = config.get<string>('yupana.serviceKey', '') ?? ''
    this.timeoutMs = config.get<number>('yupana.timeoutMs', 5000) ?? 5000
  }

  isConfigured(): boolean {
    return this.baseUrl !== '' && this.producerKey !== ''
  }

  async sendReports(reports: Record<string, unknown>[]): Promise<YupanaItemResult[]> {
    const data = await this.post<ReportResultBody[]>('/reports', { reports })
    return data.map((result) => ({
      key: result.sourceReportId ?? '',
      outcome: result.outcome,
      reason: result.reason,
    }))
  }

  async sendDeclarations(declarations: Record<string, unknown>[]): Promise<YupanaItemResult[]> {
    const data = await this.post<DeclarationResultBody[]>('/photos/declarations', { declarations })
    return data.map((result) => ({
      key: `${result.photoId ?? ''}@${result.declaredAt ?? ''}`,
      outcome: result.outcome,
      reason: result.reason,
    }))
  }

  async read(path: string, query: Record<string, string | undefined>): Promise<unknown> {
    const params = new URLSearchParams()
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined) params.append(name, value)
    }
    const search = params.toString()
    return this.request(
      `${path}${search ? `?${search}` : ''}`,
      { method: 'GET', headers: { Authorization: `Bearer ${this.serviceKey}` } },
      (status) => YupanaHttpClient.readRefusal(status, path),
    )
  }

  private static readRefusal(status: number, path: string): AppException | null {
    if (status === 404) return AppException.notFound('Cost', path)
    if (status === 400 || status === 422) {
      return AppException.businessRule('cost.invalid_query', false, { yupanaStatus: status })
    }
    return null
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const data = await this.request(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.producerKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    return data as T
  }

  private async request(
    path: string,
    init: RequestInit,
    refusal: (status: number) => AppException | null = () => null,
  ): Promise<unknown> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error))
      this.logger.warn(`yupana did not answer ${init.method} ${path}: ${cause.message}`)
      throw AppException.externalService('yupana', cause)
    }

    const body = (await response.json().catch(() => null)) as { data?: unknown } | null

    if (!response.ok) {
      const refused = refusal(response.status)
      if (refused) throw refused
      this.logger.warn(`yupana answered ${response.status} to ${init.method} ${path}`)
      throw AppException.externalService('yupana', new Error(`HTTP ${response.status}`))
    }

    return body?.data ?? null
  }
}
