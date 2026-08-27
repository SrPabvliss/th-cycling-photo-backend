import type { PaymentGatewayRegistry } from '@shared/payment-gateways'
import type { IUserReadRepository } from '@users/domain/ports'
import { VerifyPayoutReceiverHandler } from './verify-payout-receiver.handler'
import { VerifyPayoutReceiverQuery } from './verify-payout-receiver.query'

describe('VerifyPayoutReceiverHandler', () => {
  const verifyReceiver = jest.fn()
  const userRepo: jest.Mocked<Pick<IUserReadRepository, 'findTenantId'>> = {
    findTenantId: jest.fn().mockResolvedValue('tenant-1'),
  }
  const registry: jest.Mocked<Pick<PaymentGatewayRegistry, 'get'>> = {
    get: jest.fn().mockReturnValue({
      verifyReceiver,
      platformCredentials: jest.fn().mockReturnValue({}),
    }),
  }
  const handler = new VerifyPayoutReceiverHandler(userRepo as never, registry as never)

  beforeEach(() => {
    verifyReceiver.mockReset()
    userRepo.findTenantId.mockResolvedValue('tenant-1')
  })

  it('returns registered true when the gateway recognises the receiver', async () => {
    verifyReceiver.mockResolvedValue(true)
    await expect(
      handler.execute(new VerifyPayoutReceiverQuery('user-1', '+593987654321')),
    ).resolves.toEqual({ registered: true })
  })

  it('returns registered false instead of throwing when it does not', async () => {
    verifyReceiver.mockResolvedValue(false)
    await expect(
      handler.execute(new VerifyPayoutReceiverQuery('user-1', '+593912345678')),
    ).resolves.toEqual({ registered: false })
  })

  it('throws when the actor has no tenant', async () => {
    userRepo.findTenantId.mockResolvedValue(null)
    await expect(
      handler.execute(new VerifyPayoutReceiverQuery('user-1', '+593987654321')),
    ).rejects.toThrow()
  })
})
