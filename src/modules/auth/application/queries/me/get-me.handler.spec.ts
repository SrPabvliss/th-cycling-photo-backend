import type { IPermissionRepository } from '@shared/authorization/domain/ports/permission-repository.port'
import { EMPTY_PRINCIPAL_PERMISSIONS } from '@shared/authorization/domain/principal'
import { CONSENT_TYPE, POLICY_VERSION } from '../../../domain/constants/consent.constants'
import type { IAuthUserRepository, IConsentRepository } from '../../../domain/ports'
import { GetMeHandler } from './get-me.handler'
import { GetMeQuery } from './get-me.query'

describe('GetMeHandler', () => {
  let handler: GetMeHandler
  let authUserRepo: jest.Mocked<IAuthUserRepository>
  let consentRepo: jest.Mocked<IConsentRepository>
  let permissionRepo: jest.Mocked<IPermissionRepository>

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

    permissionRepo = {
      load: jest.fn().mockResolvedValue(EMPTY_PRINCIPAL_PERMISSIONS()),
    } as jest.Mocked<IPermissionRepository>

    handler = new GetMeHandler(authUserRepo, consentRepo, permissionRepo)
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

describe('GetMeHandler — permissions', () => {
  it('returns the effective permission keys, tenant and platform flag', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.templateKeys.add('event.read')
    p.globalGrants.set('order.read', 'allow')
    p.globalGrants.set('event.read', 'deny') // a deny grant removes a template permission
    p.tenantId = 't1'
    p.isPlatform = false

    const authUserRepo = {
      getMe: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.c', role: 'customer' }),
    }
    const consentRepo = { findAcceptedTypes: jest.fn().mockResolvedValue([]) }
    const permissionRepo = { load: jest.fn().mockResolvedValue(p) }

    const handler = new GetMeHandler(
      authUserRepo as never,
      consentRepo as never,
      permissionRepo as never,
    )
    const result = await handler.execute(new GetMeQuery('u1', 'a@b.c', 'customer'))

    expect(result.permissions?.sort()).toEqual(['order.read'])
    expect(result.tenantId).toBe('t1')
    expect(result.isPlatform).toBe(false)
  })

  it('strips platform-only permissions from a non-platform principal', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.templateKeys.add('buyer.read') // platform-only
    p.templateKeys.add('event.read')
    p.isPlatform = false

    const authUserRepo = {
      getMe: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.c', role: 'customer' }),
    }
    const consentRepo = { findAcceptedTypes: jest.fn().mockResolvedValue([]) }
    const permissionRepo = { load: jest.fn().mockResolvedValue(p) }

    const handler = new GetMeHandler(
      authUserRepo as never,
      consentRepo as never,
      permissionRepo as never,
    )
    const result = await handler.execute(new GetMeQuery('u1', 'a@b.c', 'customer'))

    expect(result.permissions).toEqual(['event.read'])
  })
})
