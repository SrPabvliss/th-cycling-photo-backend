import { AppException } from '@shared/domain'
import { PaymentAccountStatus } from '../value-objects/payment-account-status.vo'
import { PaymentMode } from '../value-objects/payment-mode.vo'
import { SellerPaymentAccount } from './seller-payment-account.entity'

const PROVIDER = 'payphone'

describe('SellerPaymentAccount.createForSplit', () => {
  it('starts pending and holds the receiver identifier', () => {
    const account = SellerPaymentAccount.createForSplit('user-1', PROVIDER, '984112233')

    expect(account.mode).toBe(PaymentMode.SPLIT_RECEIVER)
    expect(account.status).toBe(PaymentAccountStatus.PENDING)
    expect(account.receiverIdentifier).toBe('984112233')
    expect(account.provider).toBe(PROVIDER)
    expect(account.credentialsEncrypted).toBeNull()
  })

  it('is not usable until verified', () => {
    expect(SellerPaymentAccount.createForSplit('user-1', PROVIDER, '984112233').isUsable).toBe(
      false,
    )
  })
})

describe('SellerPaymentAccount.createForOwnMerchant', () => {
  it('holds the credentials and no receiver identifier', () => {
    const account = SellerPaymentAccount.createForOwnMerchant('user-1', PROVIDER, 'cipher')

    expect(account.mode).toBe(PaymentMode.OWN_MERCHANT)
    expect(account.credentialsEncrypted).toBe('cipher')
    expect(account.provider).toBe(PROVIDER)
    expect(account.receiverIdentifier).toBeNull()
  })
})

describe('SellerPaymentAccount.markVerified', () => {
  it('becomes usable and stamps the time', () => {
    const account = SellerPaymentAccount.createForSplit('user-1', PROVIDER, '984112233')

    account.markVerified()

    expect(account.status).toBe(PaymentAccountStatus.VERIFIED)
    expect(account.verifiedAt).toBeInstanceOf(Date)
    expect(account.isUsable).toBe(true)
  })

  it('is idempotent and keeps the original timestamp', () => {
    const account = SellerPaymentAccount.createForSplit('user-1', PROVIDER, '984112233')
    account.markVerified()
    const first = account.verifiedAt

    account.markVerified()

    expect(account.verifiedAt).toBe(first)
  })
})

describe('SellerPaymentAccount.disable', () => {
  it('stops the account from being usable', () => {
    const account = SellerPaymentAccount.createForSplit('user-1', PROVIDER, '984112233')
    account.markVerified()

    account.disable()

    expect(account.status).toBe(PaymentAccountStatus.DISABLED)
    expect(account.isUsable).toBe(false)
  })
})

describe('SellerPaymentAccount mode switching', () => {
  it('moves from merchant to split and drops the credentials', () => {
    const account = SellerPaymentAccount.createForOwnMerchant('user-1', PROVIDER, 'cipher')
    account.markVerified()

    account.updateSplitReceiver('984112233')

    expect(account.mode).toBe(PaymentMode.SPLIT_RECEIVER)
    expect(account.receiverIdentifier).toBe('984112233')
    expect(account.credentialsEncrypted).toBeNull()
  })

  it('moves from split to merchant and drops the receiver identifier', () => {
    const account = SellerPaymentAccount.createForSplit('user-1', PROVIDER, '984112233')
    account.markVerified()

    account.updateMerchantCredentials('cipher')

    expect(account.mode).toBe(PaymentMode.OWN_MERCHANT)
    expect(account.receiverIdentifier).toBeNull()
    expect(account.credentialsEncrypted).toBe('cipher')
  })

  it('returns to pending after any credential change', () => {
    const account = SellerPaymentAccount.createForSplit('user-1', PROVIDER, '984112233')
    account.markVerified()

    account.updateSplitReceiver('984999888')

    expect(account.status).toBe(PaymentAccountStatus.PENDING)
    expect(account.verifiedAt).toBeNull()
    expect(account.isUsable).toBe(false)
  })
})

describe('SellerPaymentAccount.fromPersistence', () => {
  it('rejects a split account with no receiver identifier', () => {
    expect(() =>
      SellerPaymentAccount.fromPersistence({
        id: 'a1',
        userId: 'user-1',
        provider: PROVIDER,
        mode: PaymentMode.SPLIT_RECEIVER,
        status: PaymentAccountStatus.VERIFIED,
        receiverIdentifier: null,
        credentialsEncrypted: null,
        verifiedAt: new Date(),
        createdAt: new Date(),
      }),
    ).toThrow(AppException)
  })

  it('rejects a merchant account with no credentials', () => {
    expect(() =>
      SellerPaymentAccount.fromPersistence({
        id: 'a1',
        userId: 'user-1',
        provider: PROVIDER,
        mode: PaymentMode.OWN_MERCHANT,
        status: PaymentAccountStatus.VERIFIED,
        receiverIdentifier: null,
        credentialsEncrypted: null,
        verifiedAt: new Date(),
        createdAt: new Date(),
      }),
    ).toThrow(AppException)
  })
})
