import { CONSENT_TYPE } from '../../../domain/constants/consent.constants'
import type { IConsentRepository } from '../../../domain/ports'
import { RevokeConsentsCommand } from './revoke-consents.command'
import { RevokeConsentsHandler } from './revoke-consents.handler'

describe('RevokeConsentsHandler', () => {
  const consentRepo = {
    record: jest.fn(),
    findAcceptedTypes: jest.fn(),
    findActive: jest.fn(),
    revoke: jest.fn().mockResolvedValue(undefined),
  } as jest.Mocked<IConsentRepository>
  const handler = new RevokeConsentsHandler(consentRepo)

  beforeEach(() => jest.clearAllMocks())

  it('withdraws the community emails consent', async () => {
    await handler.execute(new RevokeConsentsCommand('user-1', [CONSENT_TYPE.COMMUNITY_EMAILS]))
    expect(consentRepo.revoke).toHaveBeenCalledWith('user-1', CONSENT_TYPE.COMMUNITY_EMAILS)
  })

  it('refuses to withdraw the legal consents', async () => {
    await expect(
      handler.execute(new RevokeConsentsCommand('user-1', [CONSENT_TYPE.TERMS_PRIVACY])),
    ).rejects.toThrow()
    expect(consentRepo.revoke).not.toHaveBeenCalled()
  })
})
