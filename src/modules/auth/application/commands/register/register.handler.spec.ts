import type { LocationValidator } from '@locations/application/services'
import type { ConfigService } from '@nestjs/config'
import type { JwtService } from '@nestjs/jwt'
import { CONSENT_TYPE, POLICY_VERSIONS } from '../../../domain/constants/consent.constants'
import type {
  IAuthUserRepository,
  IConsentRepository,
  IRefreshTokenRepository,
  ITokenHashService,
} from '../../../domain/ports'
import { RegisterCommand } from './register.command'
import { RegisterHandler } from './register.handler'

const buildCommand = (acceptedTerms = false, guardianConsent = false) =>
  new RegisterCommand(
    'rider@example.com',
    'SecurePass123!',
    'Juan',
    'Perez',
    '+593991234567',
    1,
    null,
    null,
    null,
    null,
    '1.2.3.4',
    'jest-agent',
    acceptedTerms,
    guardianConsent,
  )

describe('RegisterHandler', () => {
  let handler: RegisterHandler
  let authUserRepo: jest.Mocked<IAuthUserRepository>
  let refreshTokenRepo: jest.Mocked<IRefreshTokenRepository>
  let tokenHashService: jest.Mocked<ITokenHashService>
  let consentRepo: jest.Mocked<IConsentRepository>
  let jwtService: jest.Mocked<JwtService>
  let locationValidator: jest.Mocked<LocationValidator>

  beforeEach(() => {
    authUserRepo = {
      findByEmailExists: jest.fn().mockResolvedValue(false),
      register: jest.fn().mockResolvedValue({ id: 'user-1', email: 'rider@example.com' }),
    } as unknown as jest.Mocked<IAuthUserRepository>

    refreshTokenRepo = {
      create: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IRefreshTokenRepository>

    tokenHashService = {
      hash: jest.fn().mockReturnValue('hashed'),
      generateToken: jest.fn().mockReturnValue('raw-token'),
    } as jest.Mocked<ITokenHashService>

    consentRepo = {
      record: jest.fn().mockResolvedValue(undefined),
      findAcceptedTypes: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<IConsentRepository>

    jwtService = { sign: jest.fn().mockReturnValue('jwt') } as unknown as jest.Mocked<JwtService>

    locationValidator = {
      validateFull: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LocationValidator>

    const configService = { get: jest.fn().mockReturnValue(30) } as unknown as ConfigService

    handler = new RegisterHandler(
      authUserRepo,
      refreshTokenRepo,
      tokenHashService,
      consentRepo,
      jwtService,
      locationValidator,
      configService,
    )
  })

  it('creates the user and returns tokens', async () => {
    const result = await handler.execute(buildCommand())

    expect(authUserRepo.register).toHaveBeenCalledTimes(1)
    expect(result.tokens.accessToken).toBe('jwt')
    expect(result.refreshToken).toBe('raw-token')
  })

  it('records the terms consent when accepted', async () => {
    await handler.execute(buildCommand(true))

    expect(consentRepo.record).toHaveBeenCalledTimes(1)
    expect(consentRepo.record).toHaveBeenCalledWith({
      userId: 'user-1',
      type: CONSENT_TYPE.TERMS_PRIVACY,
      policyVersion: POLICY_VERSIONS[CONSENT_TYPE.TERMS_PRIVACY],
      ipAddress: '1.2.3.4',
      userAgent: 'jest-agent',
    })
  })

  it('records the guardian consent alongside the terms consent', async () => {
    await handler.execute(buildCommand(true, true))

    expect(consentRepo.record).toHaveBeenCalledTimes(2)
    expect(consentRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: CONSENT_TYPE.GUARDIAN }),
    )
  })

  it('records nothing when consent was not given', async () => {
    await handler.execute(buildCommand(false))

    expect(consentRepo.record).not.toHaveBeenCalled()
  })

  it('still registers the user when recording the consent fails', async () => {
    consentRepo.record.mockRejectedValue(new Error('table unavailable'))

    const result = await handler.execute(buildCommand(true))

    expect(authUserRepo.register).toHaveBeenCalledTimes(1)
    expect(result.tokens.accessToken).toBe('jwt')
  })
})
