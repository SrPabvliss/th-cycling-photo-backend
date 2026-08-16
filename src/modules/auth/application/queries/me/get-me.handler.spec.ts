import { CONSENT_TYPE, POLICY_VERSION } from '../../../domain/constants/consent.constants'
import type { IAuthUserRepository, IConsentRepository } from '../../../domain/ports'
import { GetMeHandler } from './get-me.handler'
import { GetMeQuery } from './get-me.query'

describe('GetMeHandler', () => {
  let handler: GetMeHandler
  let authUserRepo: jest.Mocked<IAuthUserRepository>
  let consentRepo: jest.Mocked<IConsentRepository>

  const query = new GetMeQuery('user-1', 'rider@example.com', 'customer')

  beforeEach(() => {
    authUserRepo = {
      getMe: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'rider@example.com',
        firstName: 'Juan',
        lastName: 'Perez',
        role: 'customer',
      }),
    } as unknown as jest.Mocked<IAuthUserRepository>

    consentRepo = {
      record: jest.fn(),
      findAcceptedTypes: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<IConsentRepository>

    handler = new GetMeHandler(authUserRepo, consentRepo)
  })

  it('reports the terms consent as pending when it was never accepted', async () => {
    const me = await handler.execute(query)

    expect(consentRepo.findAcceptedTypes).toHaveBeenCalledWith('user-1', POLICY_VERSION)
    expect(me.pendingConsents).toEqual([CONSENT_TYPE.TERMS_PRIVACY])
  })

  it('reports nothing pending once the terms consent exists', async () => {
    consentRepo.findAcceptedTypes.mockResolvedValue([CONSENT_TYPE.TERMS_PRIVACY])

    const me = await handler.execute(query)

    expect(me.pendingConsents).toEqual([])
  })

  it('ignores consents recorded for a different policy version', async () => {
    consentRepo.findAcceptedTypes.mockResolvedValue([CONSENT_TYPE.GUARDIAN])

    const me = await handler.execute(query)

    expect(me.pendingConsents).toEqual([CONSENT_TYPE.TERMS_PRIVACY])
  })

  it('returns the profile with no pending consents when the lookup fails', async () => {
    consentRepo.findAcceptedTypes.mockRejectedValue(new Error('table unavailable'))

    const me = await handler.execute(query)

    expect(me.email).toBe('rider@example.com')
    expect(me.pendingConsents).toEqual([])
  })
})
