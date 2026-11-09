import { ConfigService } from '@nestjs/config'
import type { PayphoneHttpClient } from './infrastructure/payphone-http.client'
import type { PayphoneTransferToCipher } from './infrastructure/payphone-transfer-to.cipher'
import { PayphoneAdapter } from './payphone.adapter'

const amounts = {
  amountCents: 2000,
  amountWithoutTaxCents: 2000,
  amountWithTaxCents: 0,
  taxCents: 0,
}

function makeAdapter(overrides: { cipher?: PayphoneTransferToCipher | null } = {}) {
  const client = {
    isUserRegistered: jest.fn().mockResolvedValue(true),
    confirm: jest.fn(),
  } as unknown as PayphoneHttpClient
  const config = {
    getOrThrow: () => 'platform-token',
    get: () => 'platform-store',
  } as unknown as ConfigService
  const encrypt = jest.fn().mockReturnValue('encrypted-split')
  const cipher =
    overrides.cipher === undefined
      ? ({ encrypt } as unknown as PayphoneTransferToCipher)
      : overrides.cipher

  return { adapter: new PayphoneAdapter(client, config, cipher), client, encrypt }
}

function splitInstruction(encrypt: jest.Mock): Record<string, unknown>[] {
  return JSON.parse(encrypt.mock.calls[0][0])
}

describe('PayphoneAdapter', () => {
  it('builds a direct checkout payload without transferTo', () => {
    const { adapter } = makeAdapter()

    const intent = adapter.buildCheckoutIntent({
      clientTransactionId: 'tt-abc',
      amounts,
      credentials: { token: 'seller-token', storeId: 'seller-store' },
      receiverIdentifier: 'seller-store',
      transferableCents: null,
      reference: 'Fotos - orden abc12345',
      currency: 'USD',
    })

    expect(intent.provider).toBe('payphone')
    expect(intent.payload).toMatchObject({
      token: 'seller-token',
      storeId: 'seller-store',
      clientTransactionId: 'tt-abc',
      amount: 2000,
      amountWithoutTax: 2000,
      amountWithTax: 0,
      tax: 0,
      currency: 'USD',
    })
    expect(intent.payload.transferTo).toBeUndefined()
  })

  it('adds an encrypted transferTo when the charge is split', () => {
    const { adapter } = makeAdapter()

    const intent = adapter.buildCheckoutIntent({
      clientTransactionId: 'tt-abc',
      amounts,
      credentials: { token: 'platform-token', storeId: 'platform-store' },
      receiverIdentifier: '984112233',
      transferableCents: 1885,
      reference: 'Fotos - orden abc12345',
      currency: 'USD',
    })

    expect(intent.payload.transferTo).toBe('encrypted-split')
  })

  it('identifies the receiver by phone in the international format, whatever format it was stored in', () => {
    const local = makeAdapter()
    local.adapter.buildCheckoutIntent({
      clientTransactionId: 'tt-abc',
      amounts,
      credentials: { token: 'platform-token', storeId: 'platform-store' },
      receiverIdentifier: '0984112233',
      transferableCents: 1885,
      reference: 'Fotos - orden abc12345',
      currency: 'USD',
    })

    const international = makeAdapter()
    international.adapter.buildCheckoutIntent({
      clientTransactionId: 'tt-abc',
      amounts,
      credentials: { token: 'platform-token', storeId: 'platform-store' },
      receiverIdentifier: '+593984112233',
      transferableCents: 1885,
      reference: 'Fotos - orden abc12345',
      currency: 'USD',
    })

    expect(splitInstruction(local.encrypt)).toEqual([
      { Identifier: '+593984112233', Type: 4, Amount: 1885 },
    ])
    expect(splitInstruction(international.encrypt)).toEqual([
      { Identifier: '+593984112233', Type: 4, Amount: 1885 },
    ])
  })

  it('sends the amount as an integer, not a string', () => {
    const { adapter, encrypt } = makeAdapter()

    adapter.buildCheckoutIntent({
      clientTransactionId: 'tt-abc',
      amounts,
      credentials: { token: 'platform-token', storeId: 'platform-store' },
      receiverIdentifier: '984112233',
      transferableCents: 1885,
      reference: 'Fotos - orden abc12345',
      currency: 'USD',
    })

    expect(typeof splitInstruction(encrypt)[0].Amount).toBe('number')
  })

  it('refuses a non-positive amount', () => {
    const { adapter } = makeAdapter()

    expect(() =>
      adapter.buildCheckoutIntent({
        clientTransactionId: 'tt-abc',
        amounts,
        credentials: { token: 'platform-token', storeId: 'platform-store' },
        receiverIdentifier: '984112233',
        transferableCents: 0,
        reference: 'Fotos - orden abc12345',
        currency: 'USD',
      }),
    ).toThrow('payment.negative_amount')
  })

  it('refuses to build a split payload when split is not enabled', () => {
    const { adapter } = makeAdapter({ cipher: null })

    expect(() =>
      adapter.buildCheckoutIntent({
        clientTransactionId: 'tt-abc',
        amounts,
        credentials: { token: 'platform-token', storeId: 'platform-store' },
        receiverIdentifier: '984112233',
        transferableCents: 1885,
        reference: 'Fotos - orden abc12345',
        currency: 'USD',
      }),
    ).toThrow('payment.split_not_enabled')
  })

  it('translates a vendor confirmation into an authorization result', async () => {
    const { adapter, client } = makeAdapter()
    ;(client.confirm as jest.Mock).mockResolvedValue({
      approved: true,
      statusCode: 3,
      transactionId: 987,
      amount: 2000,
      authorizationCode: 'AUTH1',
      cardBrand: 'VISA',
      lastDigits: '4242',
      message: null,
      raw: { statusCode: 3 },
    })

    const result = await adapter.confirm({
      gatewayTransactionId: '987',
      clientTransactionId: 'tt-abc',
      credentials: { token: 'seller-token', storeId: null },
    })

    expect(result.approved).toBe(true)
    expect(result.gatewayTransactionId).toBe('987')
    expect(result.amountCents).toBe(2000)
  })

  it('charges the vendor commission rounded up', () => {
    const { adapter } = makeAdapter()
    expect(adapter.commissionCents(2000)).toBe(115)
  })
})
