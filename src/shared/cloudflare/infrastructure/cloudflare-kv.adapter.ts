import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain/exceptions/app.exception'
import type { IKvStorageAdapter } from '../domain/ports'

@Injectable()
export class CloudflareKvAdapter implements IKvStorageAdapter {
  private readonly logger = new Logger(CloudflareKvAdapter.name)
  private readonly accountId: string
  private readonly namespaceId: string
  private readonly apiToken: string
  private readonly baseUrl: string

  constructor(private readonly config: ConfigService) {
    this.accountId = this.config.getOrThrow<string>('cloudflare.accountId')
    this.namespaceId = this.config.getOrThrow<string>('cloudflare.kvNamespaceId')
    this.apiToken = this.config.getOrThrow<string>('cloudflare.apiToken')
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.namespaceId}`
  }

  async write(key: string, value: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/values/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${this.apiToken}` },
      body: value,
    })

    if (!response.ok) {
      const body = await response.text()
      this.logger.error(`KV write failed for key ${key}: ${response.status} ${body}`)
      throw AppException.externalService(
        'CloudflareKV',
        new Error(`KV write failed: ${response.status}`),
      )
    }
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/values/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.apiToken}` },
    })

    // 404 is acceptable — the key may already be gone
    if (!response.ok && response.status !== 404) {
      const body = await response.text()
      this.logger.error(`KV delete failed for key ${key}: ${response.status} ${body}`)
      throw AppException.externalService(
        'CloudflareKV',
        new Error(`KV delete failed: ${response.status}`),
      )
    }
  }

  async writeBulk(entries: { key: string; value: string }[]): Promise<void> {
    if (entries.length === 0) return

    const body = entries.map(({ key, value }) => ({ key, value }))

    const response = await fetch(`${this.baseUrl}/bulk`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      this.logger.error(`KV bulk write failed: ${response.status} ${text}`)
      throw AppException.externalService(
        'CloudflareKV',
        new Error(`KV bulk write failed: ${response.status}`),
      )
    }

    this.logger.log(`KV bulk write: ${entries.length} entries`)
  }
}
