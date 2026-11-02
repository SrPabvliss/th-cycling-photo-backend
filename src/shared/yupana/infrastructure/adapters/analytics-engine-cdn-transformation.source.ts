import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain/exceptions/app.exception'
import type { CdnTransformationPoint, ICdnTransformationSource } from '../../domain/ports'

const SERVICE = 'CloudflareAnalyticsEngine'
const TIMEOUT_MS = 30_000

interface SqlResponse<T> {
  data?: T[]
}

@Injectable()
export class AnalyticsEngineCdnTransformationSource implements ICdnTransformationSource {
  static readonly ROW_LIMIT = 50_000
  private readonly logger = new Logger(AnalyticsEngineCdnTransformationSource.name)
  private readonly accountId: string
  private readonly token: string
  private readonly dataset: string

  constructor(config: ConfigService) {
    this.accountId = config.get<string>('cloudflare.accountId', '') ?? ''
    this.token = config.get<string>('cloudflare.analyticsToken', '') ?? ''
    this.dataset = config.get<string>('cloudflare.transformationsDataset', '') ?? ''
  }

  isConfigured(): boolean {
    return this.accountId !== '' && this.token !== '' && this.dataset !== ''
  }

  async readDay(day: string): Promise<CdnTransformationPoint[]> {
    const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
    const rows = await this.query<{ key: string; kind: string; slug: string }>(
      `SELECT index1 AS key, blob1 AS kind, blob2 AS slug FROM ${this.dataset} ` +
        `WHERE timestamp >= toDateTime('${day} 00:00:00') AND timestamp < toDateTime('${next} 00:00:00') ` +
        `GROUP BY key, kind, slug LIMIT ${AnalyticsEngineCdnTransformationSource.ROW_LIMIT + 1} FORMAT JSON`,
    )
    if (rows.length > AnalyticsEngineCdnTransformationSource.ROW_LIMIT) {
      throw AppException.externalService(
        SERVICE,
        new Error(
          `Analytics Engine answered more than ${AnalyticsEngineCdnTransformationSource.ROW_LIMIT} combinations for ${day}`,
        ),
      )
    }
    return rows.map((row) => ({ combinationKey: row.key, kind: row.kind, slug: row.slug }))
  }

  async findFirstDay(): Promise<string | null> {
    const rows = await this.query<{ first: string | null }>(
      `SELECT min(timestamp) AS first FROM ${this.dataset} FORMAT JSON`,
    )
    const first = rows[0]?.first
    if (!first || first.startsWith('1970')) return null
    return first.slice(0, 10)
  }

  private async query<T>(sql: string): Promise<T[]> {
    if (!this.isConfigured()) {
      throw AppException.externalService(SERVICE, new Error('Analytics Engine is not configured'))
    }
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/analytics_engine/sql`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
        body: sql,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) {
        const body = await response.text()
        this.logger.error(`Analytics Engine query failed: ${response.status} ${body.slice(0, 200)}`)
        throw new Error(`Analytics Engine answered ${response.status}`)
      }
      const parsed = (await response.json()) as SqlResponse<T>
      return parsed.data ?? []
    } catch (error) {
      if (error instanceof AppException) throw error
      throw AppException.externalService(SERVICE, error as Error)
    }
  }
}
