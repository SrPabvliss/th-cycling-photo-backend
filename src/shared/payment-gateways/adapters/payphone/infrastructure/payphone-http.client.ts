import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain'
import {
  EC_COUNTRY_CODE,
  normalizeEcuadorPhone,
  toCheckFormat,
} from '../domain/value-objects/payphone-phone.vo'
import {
  ERROR_KEY_BY_CODE,
  RETRYABLE_ERROR_CODES,
  UNAUTHORISED_DOMAIN_CODE,
  VALIDATION_FAILED_CODE,
} from './payphone-error-codes'

const RETRY_ATTEMPTS = 2
const RETRY_DELAY_MS = 1_000

const API_BASE = 'https://pay.payphonetodoesposible.com'
const BOX_BASE = 'https://paymentbox.payphonetodoesposible.com'

const APPROVED_STATUS_CODE = 3

export type PayphoneCredentials = {
  token: string
  storeId: string | null
}

export type PayphoneConfirmResponse = {
  approved: boolean
  statusCode: number
  transactionId: number
  amount: number
  authorizationCode: string | null
  cardBrand: string | null
  lastDigits: string | null
  message: string | null
  raw: Record<string, unknown>
}

type PayphoneNestedError = { message?: string | string[]; errorCode?: number }

type PayphoneErrorBody = {
  message?: string
  errorCode?: number
  errors?: unknown
}

@Injectable()
export class PayphoneHttpClient {
  private readonly logger = new Logger(PayphoneHttpClient.name)
  private readonly timeoutMs: number

  constructor(config: ConfigService) {
    this.timeoutMs = config.get<number>('payphone.timeoutMs', 15_000)
  }

  async isUserRegistered(
    subscriberPhone: string,
    credentials: PayphoneCredentials,
  ): Promise<boolean> {
    const subscriber = normalizeEcuadorPhone(subscriberPhone)
    const url = `${API_BASE}/api/Users/check/${toCheckFormat(subscriber)}/region/${EC_COUNTRY_CODE}`
    const body = await this.call(url, { method: 'GET', headers: this.headers(credentials) })

    return body === true
  }

  async confirm(
    payphoneTransactionId: number,
    clientTransactionId: string,
    credentials: PayphoneCredentials,
  ): Promise<PayphoneConfirmResponse> {
    const body = (await this.call(`${BOX_BASE}/api/confirm`, {
      method: 'POST',
      headers: this.headers(credentials),
      body: JSON.stringify({ id: payphoneTransactionId, clientTxId: clientTransactionId }),
    })) as Record<string, unknown>

    const statusCode = Number(body.statusCode ?? 0)

    return {
      approved: statusCode === APPROVED_STATUS_CODE,
      statusCode,
      transactionId: Number(body.transactionId ?? payphoneTransactionId),
      amount: Number(body.amount ?? 0),
      authorizationCode: (body.authorizationCode as string) ?? null,
      cardBrand: (body.cardBrand as string) ?? null,
      lastDigits: (body.lastDigits as string) ?? null,
      message: (body.message as string) ?? null,
      raw: body,
    }
  }

  private headers(credentials: PayphoneCredentials): Record<string, string> {
    return {
      Authorization: `Bearer ${credentials.token}`,
      'Content-Type': 'application/json',
    }
  }

  private async call(url: string, init: RequestInit, remaining = RETRY_ATTEMPTS): Promise<unknown> {
    const response = await this.send(url, init)
    const body = await this.readJson(response)

    if (response.ok) return body

    const errorBody = (body ?? {}) as PayphoneErrorBody

    if (remaining > 0 && this.isRetryable(errorBody)) {
      this.logger.warn(
        `Payphone is unavailable (errorCode=${errorBody.errorCode}); retrying, ${remaining} attempt(s) left`,
      )
      await this.wait(RETRY_DELAY_MS)
      return this.call(url, init, remaining - 1)
    }

    this.raise(errorBody, response.status)
  }

  private isRetryable(body: PayphoneErrorBody): boolean {
    return body?.errorCode != null && RETRYABLE_ERROR_CODES.includes(body.errorCode)
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) })
    } catch (error) {
      this.logger.error(
        `Payphone request failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      throw AppException.businessRule('payment.gateway_unavailable')
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    return response.json().catch(() => null)
  }

  private raise(body: PayphoneErrorBody, httpStatus: number): never {
    const key = body?.errorCode != null ? ERROR_KEY_BY_CODE[body.errorCode] : undefined
    const details = this.readNestedErrors(body)

    this.logger.error(
      `Payphone responded ${httpStatus} errorCode=${body?.errorCode ?? 'none'} message=${body?.message ?? 'none'}${details ? ` details=${details}` : ''}`,
    )

    if (body?.errorCode === UNAUTHORISED_DOMAIN_CODE) {
      this.logger.error(
        'Payphone rejected the request domain (errorCode 5). The paying domain is not authorised in the Payphone console, or the Referrer-Policy in use strips the Referer header Payphone needs to validate the origin. This blocks every payment and needs an operator, not a retry.',
      )
    }

    throw AppException.businessRule(key ?? 'payment.gateway_unavailable', false, {
      errorCode: body?.errorCode,
      httpStatus,
      ...(details ? { details } : {}),
    })
  }

  private readNestedErrors(body: PayphoneErrorBody): string | null {
    if (body?.errorCode !== VALIDATION_FAILED_CODE) return null
    if (!Array.isArray(body.errors)) return null

    const messages = body.errors.flatMap((entry) => this.readNestedError(entry))

    return messages.length > 0 ? messages.join('; ') : null
  }

  private readNestedError(entry: unknown): string[] {
    if (typeof entry === 'string') return [entry]
    if (entry === null || typeof entry !== 'object') return []

    const message = (entry as PayphoneNestedError).message
    if (typeof message === 'string') return [message]
    if (Array.isArray(message)) return message.filter((item) => typeof item === 'string')

    return []
  }
}
