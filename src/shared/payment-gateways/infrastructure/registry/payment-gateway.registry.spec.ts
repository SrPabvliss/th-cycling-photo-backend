import { AppException } from '@shared/domain'
import type { IPaymentGateway } from '../../domain/ports'
import { PaymentGatewayRegistry } from './payment-gateway.registry'

const fakeGateway = { provider: 'payphone' } as IPaymentGateway

describe('PaymentGatewayRegistry', () => {
  it('returns the gateway registered under a provider name', () => {
    const registry = new PaymentGatewayRegistry([fakeGateway])
    expect(registry.get('payphone')).toBe(fakeGateway)
  })

  it('throws when no gateway matches the provider', () => {
    const registry = new PaymentGatewayRegistry([fakeGateway])
    expect(() => registry.get('stripe')).toThrow(AppException)
  })
})
