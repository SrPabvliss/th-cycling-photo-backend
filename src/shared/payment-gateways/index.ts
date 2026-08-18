export {
  assertEnvironmentMatchesDeployment,
  normalizeEcuadorPhone,
  PAYPHONE_PROVIDER,
} from './adapters/payphone'
export {
  type AuthorizationResult,
  type CheckoutIntent,
  type CheckoutIntentInput,
  type ConfirmInput,
  type GatewayCredentials,
  type IPaymentGateway,
  PAYMENT_GATEWAY_REGISTRY,
  type PaymentAmounts,
} from './domain/ports'
export { PaymentGatewayRegistry } from './infrastructure/registry/payment-gateway.registry'
export { PaymentGatewaysModule } from './payment-gateways.module'
