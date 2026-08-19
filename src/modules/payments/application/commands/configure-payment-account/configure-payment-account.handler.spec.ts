import { PaymentAccountStatus } from '@payments/domain/value-objects/payment-account-status.vo'
import { PaymentMode } from '@payments/domain/value-objects/payment-mode.vo'
import { AppException } from '@shared/domain'
import { ConfigurePaymentAccountCommand } from './configure-payment-account.command'
import { ConfigurePaymentAccountHandler } from './configure-payment-account.handler'

describe('ConfigurePaymentAccountHandler', () => {
  let readRepo: { findByUserId: jest.Mock }
  let writeRepo: { save: jest.Mock }
  let gateway: {
    provider: string
    verifyReceiver: jest.Mock
    platformCredentials: jest.Mock
    buildCheckoutIntent: jest.Mock
    confirm: jest.Mock
    commissionCents: jest.Mock
  }
  let registry: { get: jest.Mock }
  let cipher: { encrypt: jest.Mock }
  let handler: ConfigurePaymentAccountHandler

  beforeEach(() => {
    readRepo = { findByUserId: jest.fn().mockResolvedValue(null) }
    writeRepo = { save: jest.fn().mockImplementation((account) => Promise.resolve(account)) }
    gateway = {
      provider: 'payphone',
      verifyReceiver: jest.fn().mockResolvedValue(true),
      platformCredentials: jest
        .fn()
        .mockReturnValue({ token: 'platform-token', storeId: 'platform-store' }),
      buildCheckoutIntent: jest.fn(),
      confirm: jest.fn(),
      commissionCents: jest.fn(),
    }
    registry = { get: jest.fn().mockReturnValue(gateway) }
    cipher = { encrypt: jest.fn().mockReturnValue('cipher') }
    handler = new ConfigurePaymentAccountHandler(
      readRepo as never,
      writeRepo as never,
      registry as never,
      cipher as never,
    )
  })

  it('verifies a split phone with the platform token', async () => {
    await handler.execute(
      new ConfigurePaymentAccountCommand(
        'user-1',
        PaymentMode.SPLIT_RECEIVER,
        '0984112233',
        null,
        null,
      ),
    )

    expect(gateway.verifyReceiver).toHaveBeenCalledWith('0984112233', {
      token: 'platform-token',
      storeId: 'platform-store',
    })
  })

  it('stores a verified split account with the receiver identifier', async () => {
    await handler.execute(
      new ConfigurePaymentAccountCommand(
        'user-1',
        PaymentMode.SPLIT_RECEIVER,
        '+593984112233',
        null,
        null,
      ),
    )

    const saved = writeRepo.save.mock.calls[0][0]
    expect(saved.receiverIdentifier).toBe('984112233')
    expect(saved.provider).toBe('payphone')
    expect(saved.status).toBe(PaymentAccountStatus.VERIFIED)
  })

  it.each([
    '0984112233',
    '+593984112233',
  ])('normalizes %s to the canonical subscriber form before persisting', async (rawPhone) => {
    await handler.execute(
      new ConfigurePaymentAccountCommand(
        'user-1',
        PaymentMode.SPLIT_RECEIVER,
        rawPhone,
        null,
        null,
      ),
    )

    const saved = writeRepo.save.mock.calls[0][0]
    expect(saved.receiverIdentifier).toBe('984112233')
  })

  it('refuses a phone with no account at the gateway', async () => {
    gateway.verifyReceiver.mockResolvedValue(false)

    await expect(
      handler.execute(
        new ConfigurePaymentAccountCommand(
          'user-1',
          PaymentMode.SPLIT_RECEIVER,
          '0984112233',
          null,
          null,
        ),
      ),
    ).rejects.toThrow(AppException)
    expect(writeRepo.save).not.toHaveBeenCalled()
  })

  it('does not verify a merchant account against the gateway', async () => {
    await handler.execute(
      new ConfigurePaymentAccountCommand(
        'user-1',
        PaymentMode.OWN_MERCHANT,
        null,
        'their-token',
        'their-store',
      ),
    )

    expect(gateway.verifyReceiver).not.toHaveBeenCalled()
  })

  it('encrypts the merchant credentials before saving them', async () => {
    await handler.execute(
      new ConfigurePaymentAccountCommand(
        'user-1',
        PaymentMode.OWN_MERCHANT,
        null,
        'their-token',
        'their-store',
      ),
    )

    expect(cipher.encrypt).toHaveBeenCalledWith(
      JSON.stringify({ token: 'their-token', storeId: 'their-store' }),
    )
    expect(writeRepo.save.mock.calls[0][0].credentialsEncrypted).toBe('cipher')
  })

  it('accepts merchant credentials without any gateway verification', async () => {
    const result = await handler.execute(
      new ConfigurePaymentAccountCommand(
        'user-1',
        PaymentMode.OWN_MERCHANT,
        null,
        'their-token',
        null,
      ),
    )

    expect(result.id).toBeDefined()
    expect(writeRepo.save.mock.calls[0][0].status).toBe(PaymentAccountStatus.VERIFIED)
  })

  it('updates an existing account instead of creating a second one', async () => {
    const existing = {
      id: 'existing',
      updateSplitReceiver: jest.fn(),
      markVerified: jest.fn(),
    }
    readRepo.findByUserId.mockResolvedValue(existing)

    const result = await handler.execute(
      new ConfigurePaymentAccountCommand(
        'user-1',
        PaymentMode.SPLIT_RECEIVER,
        '0984112233',
        null,
        null,
      ),
    )

    expect(existing.updateSplitReceiver).toHaveBeenCalledWith('984112233')
    expect(existing.markVerified).toHaveBeenCalled()
    expect(result).toEqual({ id: 'existing' })
  })

  it('rejects a split request with no phone', async () => {
    await expect(
      handler.execute(
        new ConfigurePaymentAccountCommand('user-1', PaymentMode.SPLIT_RECEIVER, null, null, null),
      ),
    ).rejects.toThrow(AppException)
  })

  it('rejects a merchant request with no token', async () => {
    await expect(
      handler.execute(
        new ConfigurePaymentAccountCommand('user-1', PaymentMode.OWN_MERCHANT, null, null, null),
      ),
    ).rejects.toThrow(AppException)
  })
})
