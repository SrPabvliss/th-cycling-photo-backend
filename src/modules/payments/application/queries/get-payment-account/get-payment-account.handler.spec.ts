import { PaymentAccountStatus } from '@payments/domain/value-objects/payment-account-status.vo'
import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import { GetPaymentAccountHandler } from './get-payment-account.handler'
import { GetPaymentAccountQuery } from './get-payment-account.query'

describe('GetPaymentAccountHandler', () => {
  let readRepo: { findByUserId: jest.Mock }
  let cipher: { decrypt: jest.Mock }
  let handler: GetPaymentAccountHandler

  beforeEach(() => {
    readRepo = { findByUserId: jest.fn() }
    cipher = { decrypt: jest.fn() }
    handler = new GetPaymentAccountHandler(readRepo as never, cipher as never)
  })

  it('returns null when nothing is configured', async () => {
    readRepo.findByUserId.mockResolvedValue(null)

    await expect(handler.execute(new GetPaymentAccountQuery('user-1'))).resolves.toBeNull()
  })

  it('projects a verified split account', async () => {
    readRepo.findByUserId.mockResolvedValue({
      provider: 'payphone',
      mode: PaymentMode.SPLIT_RECEIVER,
      status: PaymentAccountStatus.VERIFIED,
      receiverIdentifier: '984112233',
      credentialsEncrypted: null,
      verifiedAt: new Date('2026-08-14T10:00:00Z'),
      isUsable: true,
    })

    const result = await handler.execute(new GetPaymentAccountQuery('user-1'))

    expect(result).toEqual({
      provider: 'payphone',
      mode: PaymentMode.SPLIT_RECEIVER,
      status: PaymentAccountStatus.VERIFIED,
      phone: '984112233',
      storeId: null,
      verifiedAt: new Date('2026-08-14T10:00:00Z'),
      isUsable: true,
    })
  })

  it('never exposes the stored credentials', async () => {
    cipher.decrypt.mockReturnValue(JSON.stringify({ token: 'secret-token', storeId: 'store-1' }))
    readRepo.findByUserId.mockResolvedValue({
      provider: 'payphone',
      mode: PaymentMode.OWN_MERCHANT,
      status: PaymentAccountStatus.VERIFIED,
      receiverIdentifier: null,
      credentialsEncrypted: 'secret-cipher',
      verifiedAt: new Date(),
      isUsable: true,
    })

    const result = await handler.execute(new GetPaymentAccountQuery('user-1'))

    expect(result?.storeId).toBe('store-1')
    expect(JSON.stringify(result)).not.toContain('secret-cipher')
    expect(JSON.stringify(result)).not.toContain('secret-token')
    expect(result).not.toHaveProperty('credentialsEncrypted')
  })
})
