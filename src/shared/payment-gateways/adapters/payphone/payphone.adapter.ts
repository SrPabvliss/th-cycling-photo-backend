import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain'
import type {
  AuthorizationResult,
  CheckoutIntent,
  CheckoutIntentInput,
  ConfirmInput,
  GatewayCredentials,
  IPaymentGateway,
} from '../../domain/ports'
import { payphoneCommissionCents } from './domain/payphone-commission'
import {
  normalizeEcuadorPhone,
  SPLIT_TYPE_PHONE,
  toSplitFormat,
} from './domain/value-objects/payphone-phone.vo'
import { type PayphoneCredentials, PayphoneHttpClient } from './infrastructure/payphone-http.client'
import { PayphoneTransferToCipher } from './infrastructure/payphone-transfer-to.cipher'
import { PAYPHONE_PROVIDER } from './payphone.constants'

@Injectable()
export class PayphoneAdapter implements IPaymentGateway {
  readonly provider = PAYPHONE_PROVIDER

  constructor(
    private readonly client: PayphoneHttpClient,
    private readonly config: ConfigService,
    @Inject(PayphoneTransferToCipher)
    private readonly cipher: PayphoneTransferToCipher | null,
  ) {}

  buildCheckoutIntent(input: CheckoutIntentInput): CheckoutIntent {
    const credentials = this.toPayphoneCredentials(input.credentials)

    const payload: Record<string, unknown> = {
      token: credentials.token,
      storeId: credentials.storeId,
      clientTransactionId: input.clientTransactionId,
      amount: input.amounts.amountCents,
      amountWithoutTax: input.amounts.amountWithoutTaxCents,
      amountWithTax: input.amounts.amountWithTaxCents,
      tax: input.amounts.taxCents,
      currency: input.currency,
      reference: input.reference,
    }

    if (input.transferableCents !== null) {
      payload.transferTo = this.buildTransferTo(input.receiverIdentifier, input.transferableCents)
    }

    return { provider: this.provider, payload }
  }

  async confirm(input: ConfirmInput): Promise<AuthorizationResult> {
    const response = await this.client.confirm(
      Number(input.gatewayTransactionId),
      input.clientTransactionId,
      this.toPayphoneCredentials(input.credentials),
    )

    return {
      approved: response.approved,
      gatewayTransactionId: String(response.transactionId),
      amountCents: response.amount,
      authorizationCode: response.authorizationCode,
      cardBrand: response.cardBrand,
      lastDigits: response.lastDigits,
      message: response.message,
      raw: response.raw,
    }
  }

  async verifyReceiver(identifier: string, _credentials: GatewayCredentials): Promise<boolean> {
    // These are a separate Payphone application of type API, distinct from the Web
    // application whose token the checkout box (Cajita de Pagos) uses. Payphone caps
    // an account at 3 applications and an app's environment is switched in place — its
    // token does not change between test and production. Switch this API application
    // to production in the Payphone console before going live; leave it in test while developing.
    const apiToken = this.config.get<string>('payphone.apiToken')
    const apiStoreId = this.config.get<string>('payphone.apiStoreId')
    if (!apiToken || !apiStoreId) {
      throw AppException.businessRule('payment.receiver_verification_unavailable')
    }

    return this.client.isUserRegistered(identifier, { token: apiToken, storeId: apiStoreId })
  }

  commissionCents(amountCents: number): number {
    return payphoneCommissionCents(amountCents)
  }

  platformCredentials(): GatewayCredentials {
    return {
      token: this.config.getOrThrow<string>('payphone.token'),
      storeId: this.config.get<string>('payphone.storeId') ?? null,
    }
  }

  private buildTransferTo(receiverIdentifier: string, transferableCents: number): string {
    if (!this.cipher) throw AppException.businessRule('payment.split_not_enabled')
    if (transferableCents <= 0) throw AppException.businessRule('payment.negative_amount')

    return this.cipher.encrypt(
      JSON.stringify([
        {
          Identifier: toSplitFormat(normalizeEcuadorPhone(receiverIdentifier)),
          Type: SPLIT_TYPE_PHONE,
          Amount: transferableCents,
        },
      ]),
    )
  }

  private toPayphoneCredentials(credentials: GatewayCredentials): PayphoneCredentials {
    return {
      token: credentials.token as string,
      storeId: (credentials.storeId as string | null) ?? null,
    }
  }
}
