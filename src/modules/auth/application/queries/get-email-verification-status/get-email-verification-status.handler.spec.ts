import { GetEmailVerificationStatusHandler } from './get-email-verification-status.handler'
import { GetEmailVerificationStatusQuery } from './get-email-verification-status.query'

describe('GetEmailVerificationStatusHandler', () => {
  let handler: GetEmailVerificationStatusHandler
  let codeRepo: { findLatestUnconsumedByUser: jest.Mock }

  beforeEach(() => {
    codeRepo = { findLatestUnconsumedByUser: jest.fn() }
    handler = new GetEmailVerificationStatusHandler(codeRepo as never)
  })

  const query = new GetEmailVerificationStatusQuery('user-1')

  it('should report nothing pending and not expired when there is no code', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue(null)

    const status = await handler.execute(query)

    expect(status).toEqual({
      pending: false,
      expired: false,
      purpose: null,
      maskedTargetEmail: null,
      expiresAt: null,
      attemptsRemaining: null,
    })
  })

  it('should report expired but keep purpose and masked address when the code is past its expiry', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue({
      id: 'code-1',
      purpose: 'verify_current',
      targetEmail: 'rider@example.com',
      expiresAt: new Date(Date.now() - 1000),
      attempts: 0,
    })

    const status = await handler.execute(query)

    expect(status.pending).toBe(false)
    expect(status.expired).toBe(true)
    expect(status.purpose).toBe('verify_current')
    expect(status.maskedTargetEmail).toBe('ri***@example.com')
  })

  it('should report the masked address, purpose, expiry and attempts remaining when there is a usable code', async () => {
    codeRepo.findLatestUnconsumedByUser.mockResolvedValue({
      id: 'code-1',
      purpose: 'verify_current',
      targetEmail: 'ejemplo@gmail.com',
      expiresAt: new Date(Date.now() + 5 * 60_000),
      attempts: 2,
    })

    const status = await handler.execute(query)

    expect(status.pending).toBe(true)
    expect(status.expired).toBe(false)
    expect(status.purpose).toBe('verify_current')
    expect(status.maskedTargetEmail).toBe('ej***@gmail.com')
    expect(status.attemptsRemaining).toBe(3)
  })
})
