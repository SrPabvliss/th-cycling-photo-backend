import { CONSENT_TYPE, POLICY_VERSIONS } from '../../../domain/constants/consent.constants'
import type { IConsentRepository } from '../../../domain/ports'
import { RecordConsentsCommand } from './record-consents.command'
import { RecordConsentsHandler } from './record-consents.handler'

describe('RecordConsentsHandler', () => {
  let handler: RecordConsentsHandler
  let consentRepo: jest.Mocked<IConsentRepository>

  beforeEach(() => {
    consentRepo = {
      record: jest.fn().mockResolvedValue(undefined),
      findAcceptedTypes: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<IConsentRepository>

    handler = new RecordConsentsHandler(consentRepo)
  })

  it('records the terms and privacy consent for the current policy version', async () => {
    await handler.execute(
      new RecordConsentsCommand('user-1', [CONSENT_TYPE.TERMS_PRIVACY], '1.2.3.4', 'jest-agent'),
    )

    expect(consentRepo.record).toHaveBeenCalledTimes(1)
    expect(consentRepo.record).toHaveBeenCalledWith({
      userId: 'user-1',
      type: CONSENT_TYPE.TERMS_PRIVACY,
      policyVersion: POLICY_VERSIONS[CONSENT_TYPE.TERMS_PRIVACY],
      ipAddress: '1.2.3.4',
      userAgent: 'jest-agent',
    })
  })

  it('records every requested consent type', async () => {
    await handler.execute(
      new RecordConsentsCommand('user-1', [CONSENT_TYPE.TERMS_PRIVACY, CONSENT_TYPE.GUARDIAN]),
    )

    expect(consentRepo.record).toHaveBeenCalledTimes(2)
    expect(consentRepo.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: CONSENT_TYPE.GUARDIAN }),
    )
  })

  it('does nothing when no consent types are given', async () => {
    await handler.execute(new RecordConsentsCommand('user-1', []))

    expect(consentRepo.record).not.toHaveBeenCalled()
  })

  it('defaults ip and user agent to null when absent', async () => {
    await handler.execute(new RecordConsentsCommand('user-1', [CONSENT_TYPE.TERMS_PRIVACY]))

    expect(consentRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: null, userAgent: null }),
    )
  })
})
