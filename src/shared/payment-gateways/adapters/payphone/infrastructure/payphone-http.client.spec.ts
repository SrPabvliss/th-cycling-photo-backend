import { Logger } from '@nestjs/common'
import { AppException } from '@shared/domain'
import { PayphoneHttpClient } from './payphone-http.client'

const CREDENTIALS = { token: 'tok', storeId: 'store-1' }

function buildClient(): PayphoneHttpClient {
  const config = { get: jest.fn().mockReturnValue(10000) }
  const client = new PayphoneHttpClient(config as never)
  jest
    .spyOn(client as unknown as { wait: () => Promise<void> }, 'wait')
    .mockResolvedValue(undefined)
  return client
}

function mockFetchOnce(body: unknown, status = 200): jest.Mock {
  const mock = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })
  global.fetch = mock as never
  return mock
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('PayphoneHttpClient.isUserRegistered', () => {
  it('calls the check endpoint with the leading zero and numeric region', async () => {
    const fetchMock = mockFetchOnce(true)

    await buildClient().isUserRegistered('984112233', CREDENTIALS)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://pay.payphonetodoesposible.com/api/Users/check/0984112233/region/593',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    )
  })

  it('returns true when Payphone says the number is registered', async () => {
    mockFetchOnce(true)

    await expect(buildClient().isUserRegistered('984112233', CREDENTIALS)).resolves.toBe(true)
  })

  it('returns false when Payphone says it is not', async () => {
    mockFetchOnce(false)

    await expect(buildClient().isUserRegistered('984112233', CREDENTIALS)).resolves.toBe(false)
  })

  it('raises a credential error when the token is rejected', async () => {
    mockFetchOnce({ message: 'invalid', errorCode: 802 }, 401)

    await expect(buildClient().isUserRegistered('984112233', CREDENTIALS)).rejects.toThrow(
      AppException,
    )
  })

  it('raises a gateway error when the network fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as never

    await expect(buildClient().isUserRegistered('984112233', CREDENTIALS)).rejects.toThrow(
      AppException,
    )
  })
})

describe('PayphoneHttpClient.confirm', () => {
  it('posts to the payment box host with clientTxId', async () => {
    const fetchMock = mockFetchOnce({
      statusCode: 3,
      transactionStatus: 'Approved',
      transactionId: 1,
    })

    await buildClient().confirm(42, 'tx-1', CREDENTIALS)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://paymentbox.payphonetodoesposible.com/api/confirm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: 42, clientTxId: 'tx-1' }),
      }),
    )
  })

  it('reports an approved transaction', async () => {
    mockFetchOnce({
      statusCode: 3,
      transactionStatus: 'Approved',
      transactionId: 23178284,
      authorizationCode: 'W23178284',
      cardBrand: 'Mastercard',
      lastDigits: 'XX17',
      message: null,
    })

    const result = await buildClient().confirm(23178284, 'tx-1', CREDENTIALS)

    expect(result.approved).toBe(true)
    expect(result.statusCode).toBe(3)
    expect(result.authorizationCode).toBe('W23178284')
    expect(result.lastDigits).toBe('XX17')
  })

  it('reports a declined transaction with the bank message', async () => {
    mockFetchOnce({
      statusCode: 2,
      transactionStatus: 'Canceled',
      transactionId: 5,
      message: 'Fondos Insuficientes',
    })

    const result = await buildClient().confirm(5, 'tx-1', CREDENTIALS)

    expect(result.approved).toBe(false)
    expect(result.message).toBe('Fondos Insuficientes')
  })

  it('translates the daily card limit into its own business error', async () => {
    mockFetchOnce({ message: 'Solo se permiten 1 transacciones por dia', errorCode: 26 }, 400)

    await expect(buildClient().confirm(5, 'tx-1', CREDENTIALS)).rejects.toMatchObject({
      messageKey: 'payment.card_daily_limit',
    })
  })

  it('translates an unauthorised domain into its own error', async () => {
    mockFetchOnce({ message: 'dominio', errorCode: 5 }, 400)

    await expect(buildClient().confirm(5, 'tx-1', CREDENTIALS)).rejects.toMatchObject({
      messageKey: 'payment.gateway_unavailable',
    })
  })

  it('reports the amount Payphone actually charged', async () => {
    mockFetchOnce({ statusCode: 3, transactionId: 7, amount: 5000 })

    const result = await buildClient().confirm(7, 'tx-1', CREDENTIALS)

    expect(result.amount).toBe(5000)
  })

  it('reports a zero amount when Payphone omits it', async () => {
    mockFetchOnce({ statusCode: 3, transactionId: 7 })

    const result = await buildClient().confirm(7, 'tx-1', CREDENTIALS)

    expect(result.amount).toBe(0)
  })

  it('translates a duplicate transaction id into its own error', async () => {
    mockFetchOnce({ message: 'duplicada', errorCode: 23 }, 400)

    await expect(buildClient().confirm(5, 'tx-1', CREDENTIALS)).rejects.toMatchObject({
      messageKey: 'payment.duplicate_transaction',
    })
  })

  it('translates an unregistered phone number into its own error', async () => {
    mockFetchOnce({ message: 'no registrado', errorCode: 120 }, 400)

    await expect(buildClient().confirm(5, 'tx-1', CREDENTIALS)).rejects.toMatchObject({
      messageKey: 'payment.phone_not_registered',
    })
  })

  it('does not skip the error map when the code is zero', async () => {
    mockFetchOnce({ message: 'zero', errorCode: 0 }, 400)

    await expect(buildClient().confirm(5, 'tx-1', CREDENTIALS)).rejects.toMatchObject({
      context: expect.objectContaining({ errorCode: 0 }),
    })
  })

  it('retries twice before giving up when Payphone reports itself unavailable', async () => {
    const fetchMock = mockFetchOnce({ message: 'unavailable', errorCode: 500 }, 500)

    await expect(buildClient().confirm(5, 'tx-1', CREDENTIALS)).rejects.toMatchObject({
      messageKey: 'payment.gateway_unavailable',
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('stops retrying as soon as Payphone answers', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ errorCode: 501 }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ statusCode: 3, transactionId: 7, amount: 100 }),
      })
    global.fetch = fetchMock as never

    const result = await buildClient().confirm(7, 'tx-1', CREDENTIALS)

    expect(result.approved).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry an error the vendor will keep returning', async () => {
    const fetchMock = mockFetchOnce({ message: 'limite', errorCode: 26 }, 400)

    await expect(buildClient().confirm(5, 'tx-1', CREDENTIALS)).rejects.toThrow(AppException)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('escalates an unauthorised domain, naming the two causes an operator must check', async () => {
    mockFetchOnce({ message: 'dominio', errorCode: 5 }, 400)
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

    await expect(buildClient().confirm(5, 'tx-1', CREDENTIALS)).rejects.toThrow(AppException)

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Referrer-Policy'))
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('not authorised'))
  })

  it('reads the nested errors of an 800 when they arrive as objects', async () => {
    mockFetchOnce(
      {
        message: 'validation',
        errorCode: 800,
        errors: [{ message: 'amount mismatch', errorCode: 0 }],
      },
      400,
    )

    await expect(buildClient().confirm(5, 'tx-1', CREDENTIALS)).rejects.toMatchObject({
      context: expect.objectContaining({ details: 'amount mismatch' }),
    })
  })

  it('reads the nested errors of an 800 when the messages arrive as arrays of strings', async () => {
    mockFetchOnce(
      {
        message: 'validation',
        errorCode: 800,
        errors: [{ message: ['amount mismatch', 'tax mismatch'] }],
      },
      400,
    )

    await expect(buildClient().confirm(5, 'tx-1', CREDENTIALS)).rejects.toMatchObject({
      context: expect.objectContaining({ details: 'amount mismatch; tax mismatch' }),
    })
  })

  it('keeps the raw payload for auditing', async () => {
    const body = { statusCode: 3, transactionStatus: 'Approved', transactionId: 7, bin: '530219' }
    mockFetchOnce(body)

    const result = await buildClient().confirm(7, 'tx-1', CREDENTIALS)

    expect(result.raw).toEqual(body)
  })
})
