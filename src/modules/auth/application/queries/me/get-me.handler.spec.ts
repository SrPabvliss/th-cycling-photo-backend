import type { IPermissionRepository } from '@shared/authorization/domain/ports/permission-repository.port'
import { EMPTY_PRINCIPAL_PERMISSIONS } from '@shared/authorization/domain/principal'
import { CONSENT_TYPE, POLICY_VERSIONS } from '../../../domain/constants/consent.constants'
import { PROMPT_KEY } from '../../../domain/constants/user-prompt.constants'
import type {
  IAuthUserRepository,
  IConsentRepository,
  IUserPromptSnoozeRepository,
} from '../../../domain/ports'
import { GetMeHandler } from './get-me.handler'
import { GetMeQuery } from './get-me.query'

const emptyPromptSnoozeRepo = (): jest.Mocked<IUserPromptSnoozeRepository> =>
  ({
    snooze: jest.fn(),
    findByUser: jest.fn().mockResolvedValue([]),
    lastSnoozedAt: jest.fn().mockResolvedValue(null),
  }) as jest.Mocked<IUserPromptSnoozeRepository>

describe('GetMeHandler', () => {
  let handler: GetMeHandler
  let authUserRepo: jest.Mocked<IAuthUserRepository>
  let consentRepo: jest.Mocked<IConsentRepository>
  let permissionRepo: jest.Mocked<IPermissionRepository>
  let promptSnoozeRepo: jest.Mocked<IUserPromptSnoozeRepository>

  const query = new GetMeQuery('user-1', 'rider@example.com', 'customer')

  beforeEach(() => {
    authUserRepo = {
      getMe: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'rider@example.com',
        firstName: 'Juan',
        lastName: 'Perez',
        role: 'customer',
        emailVerified: true,
        isProtected: false,
        hasPersonalProfile: true,
      }),
    } as unknown as jest.Mocked<IAuthUserRepository>

    consentRepo = {
      record: jest.fn(),
      findAcceptedTypes: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<IConsentRepository>

    permissionRepo = {
      load: jest.fn().mockResolvedValue(EMPTY_PRINCIPAL_PERMISSIONS()),
    } as jest.Mocked<IPermissionRepository>

    promptSnoozeRepo = emptyPromptSnoozeRepo()

    handler = new GetMeHandler(authUserRepo, consentRepo, permissionRepo, promptSnoozeRepo)
  })

  it('reports the terms consent as pending when it was never accepted', async () => {
    const me = await handler.execute(query)

    expect(consentRepo.findAcceptedTypes).toHaveBeenCalledWith(
      'user-1',
      POLICY_VERSIONS[CONSENT_TYPE.TERMS_PRIVACY],
    )
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

  it('never asks a buyer for the tenant terms', async () => {
    consentRepo.findAcceptedTypes.mockResolvedValue([])

    const me = await handler.execute(query)

    expect(me.pendingConsents).not.toContain('terms_tenant')
  })
})

describe('GetMeHandler — pendingPrompts', () => {
  let handler: GetMeHandler
  let authUserRepo: jest.Mocked<IAuthUserRepository>
  let consentRepo: jest.Mocked<IConsentRepository>
  let permissionRepo: jest.Mocked<IPermissionRepository>
  let promptSnoozeRepo: jest.Mocked<IUserPromptSnoozeRepository>

  const query = new GetMeQuery('user-1', 'rider@example.com', 'customer')

  const meRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    email: 'rider@example.com',
    firstName: 'Juan',
    lastName: 'Perez',
    role: 'customer',
    emailVerified: false,
    isProtected: false,
    hasPersonalProfile: true,
    ...overrides,
  })

  beforeEach(() => {
    authUserRepo = {
      getMe: jest.fn().mockResolvedValue(meRecord()),
    } as unknown as jest.Mocked<IAuthUserRepository>

    consentRepo = {
      record: jest.fn(),
      findAcceptedTypes: jest.fn().mockResolvedValue([CONSENT_TYPE.TERMS_PRIVACY]),
    } as jest.Mocked<IConsentRepository>

    permissionRepo = {
      load: jest.fn().mockResolvedValue(EMPTY_PRINCIPAL_PERMISSIONS()),
    } as jest.Mocked<IPermissionRepository>

    promptSnoozeRepo = emptyPromptSnoozeRepo()

    handler = new GetMeHandler(authUserRepo, consentRepo, permissionRepo, promptSnoozeRepo)
  })

  it('returns nothing when consents are still pending, even with an unverified email', async () => {
    consentRepo.findAcceptedTypes.mockResolvedValue([])

    const me = await handler.execute(query)

    expect(me.pendingConsents).toEqual([CONSENT_TYPE.TERMS_PRIVACY])
    expect(me.pendingPrompts).toEqual([])
  })

  it('excludes a protected account from every non-legal prompt', async () => {
    authUserRepo.getMe.mockResolvedValue(meRecord({ isProtected: true }))

    const me = await handler.execute(query)

    expect(me.pendingPrompts).toEqual([])
  })

  it('excludes a platform principal from every non-legal prompt', async () => {
    authUserRepo.getMe.mockResolvedValue(
      meRecord({ emailVerified: true, hasPersonalProfile: false }),
    )
    permissionRepo.load.mockResolvedValue({
      ...EMPTY_PRINCIPAL_PERMISSIONS(),
      isPlatform: true,
    })

    const me = await handler.execute(query)

    expect(me.pendingPrompts).toEqual([])
  })

  it('returns nothing during the 24h global cooldown after the last snooze', async () => {
    promptSnoozeRepo.lastSnoozedAt.mockResolvedValue(new Date(Date.now() - 2 * 60 * 60 * 1000))

    const me = await handler.execute(query)

    expect(me.pendingPrompts).toEqual([])
  })

  it('drops a prompt whose own snoozed_until is still in the future', async () => {
    promptSnoozeRepo.lastSnoozedAt.mockResolvedValue(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    )
    promptSnoozeRepo.findByUser.mockResolvedValue([
      {
        id: 'snooze-1',
        userId: 'user-1',
        promptKey: 'email_verification',
        snoozedUntil: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date(),
      },
    ])

    const me = await handler.execute(query)

    expect(me.pendingPrompts).toEqual([])
  })

  it('returns email_verification when the email is unverified and nothing blocks it', async () => {
    const me = await handler.execute(query)

    expect(me.pendingPrompts).toEqual(['email_verification'])
  })

  it('returns nothing once the email is verified', async () => {
    authUserRepo.getMe.mockResolvedValue(meRecord({ emailVerified: true }))

    const me = await handler.execute(query)

    expect(me.pendingPrompts).toEqual([])
  })

  it('asks an account with no personal profile to complete it', async () => {
    authUserRepo.getMe.mockResolvedValue(
      meRecord({ emailVerified: true, hasPersonalProfile: false }),
    )

    const me = await handler.execute(query)

    expect(me.pendingPrompts).toContain(PROMPT_KEY.PERSONAL_PROFILE)
  })

  it('does not ask when the personal profile is there', async () => {
    authUserRepo.getMe.mockResolvedValue(
      meRecord({ emailVerified: true, hasPersonalProfile: true }),
    )

    const me = await handler.execute(query)

    expect(me.pendingPrompts).not.toContain(PROMPT_KEY.PERSONAL_PROFILE)
  })

  it('keeps /auth/me working with an empty list when the prompt repository fails', async () => {
    promptSnoozeRepo.lastSnoozedAt.mockRejectedValue(new Error('table unavailable'))

    const me = await handler.execute(query)

    expect(me.email).toBe('rider@example.com')
    expect(me.pendingPrompts).toEqual([])
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
    const promptSnoozeRepo = emptyPromptSnoozeRepo()

    const handler = new GetMeHandler(
      authUserRepo as never,
      consentRepo as never,
      permissionRepo as never,
      promptSnoozeRepo,
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
    const promptSnoozeRepo = emptyPromptSnoozeRepo()

    const handler = new GetMeHandler(
      authUserRepo as never,
      consentRepo as never,
      permissionRepo as never,
      promptSnoozeRepo,
    )
    const result = await handler.execute(new GetMeQuery('u1', 'a@b.c', 'customer'))

    expect(result.permissions).toEqual(['event.read'])
  })

  it('strips a platform-only permission granted directly, not just template-sourced ones', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.globalGrants.set('buyer.read', 'allow') // platform-only, arrives via grant rather than template
    p.isPlatform = false

    const authUserRepo = {
      getMe: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.c', role: 'customer' }),
    }
    const consentRepo = { findAcceptedTypes: jest.fn().mockResolvedValue([]) }
    const permissionRepo = { load: jest.fn().mockResolvedValue(p) }
    const promptSnoozeRepo = emptyPromptSnoozeRepo()

    const handler = new GetMeHandler(
      authUserRepo as never,
      consentRepo as never,
      permissionRepo as never,
      promptSnoozeRepo,
    )
    const result = await handler.execute(new GetMeQuery('u1', 'a@b.c', 'customer'))

    expect(result.permissions).toEqual([])
  })

  it('excludes event-scoped grants from the global permission list', async () => {
    const p = EMPTY_PRINCIPAL_PERMISSIONS()
    p.templateKeys.add('event.read')
    p.eventGrants.set('event-1', new Map([['photo.review', 'allow']]))

    const authUserRepo = {
      getMe: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.c', role: 'customer' }),
    }
    const consentRepo = { findAcceptedTypes: jest.fn().mockResolvedValue([]) }
    const permissionRepo = { load: jest.fn().mockResolvedValue(p) }
    const promptSnoozeRepo = emptyPromptSnoozeRepo()

    const handler = new GetMeHandler(
      authUserRepo as never,
      consentRepo as never,
      permissionRepo as never,
      promptSnoozeRepo,
    )
    const result = await handler.execute(new GetMeQuery('u1', 'a@b.c', 'customer'))

    expect(result.permissions).toEqual(['event.read'])
    expect(result.permissions).not.toContain('photo.review')
  })
})
