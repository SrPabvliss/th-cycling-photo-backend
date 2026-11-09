export type GatewayCredentials = Record<string, unknown>

export interface PaymentAmounts {
  amountCents: number
  amountWithoutTaxCents: number
  amountWithTaxCents: number
  taxCents: number
}

export interface CheckoutIntentInput {
  clientTransactionId: string
  amounts: PaymentAmounts
  credentials: GatewayCredentials
  receiverIdentifier: string
  transferableCents: number | null
  reference: string
  currency: string
}

export interface CheckoutIntent {
  provider: string
  payload: Record<string, unknown>
}

export interface ConfirmInput {
  gatewayTransactionId: string
  clientTransactionId: string
  credentials: GatewayCredentials
}

export interface AuthorizationResult {
  approved: boolean
  gatewayTransactionId: string
  amountCents: number
  authorizationCode: string | null
  cardBrand: string | null
  lastDigits: string | null
  message: string | null
  raw: Record<string, unknown>
}

export interface IPaymentGateway {
  readonly provider: string
  buildCheckoutIntent(input: CheckoutIntentInput): CheckoutIntent
  confirm(input: ConfirmInput): Promise<AuthorizationResult>
  verifyReceiver(identifier: string, credentials: GatewayCredentials): Promise<boolean>
  commissionCents(amountCents: number): number
  platformCredentials(): GatewayCredentials
}

export const PAYMENT_GATEWAY_REGISTRY = Symbol('PAYMENT_GATEWAY_REGISTRY')
