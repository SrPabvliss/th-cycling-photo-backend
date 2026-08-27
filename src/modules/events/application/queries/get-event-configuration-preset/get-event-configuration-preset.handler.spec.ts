import { EventConfigurationService } from '@events/application/services/event-configuration.service'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure/cdn-url.builder'
import type { TenantPayoutMethod } from '@tenants/domain/entities/tenant-payout-method.entity'
import { TenantProfile } from '@tenants/domain/entities/tenant-profile.entity'
import type { ITenantPayoutMethodRepository } from '@tenants/domain/ports/tenant-payout-method-repository.port'
import type { ITenantProfileRepository } from '@tenants/domain/ports/tenant-profile-repository.port'
import { PayoutProvider } from '@tenants/domain/value-objects/payout-provider.vo'
import type { IUserReadRepository } from '@users/domain/ports'
import { GetEventConfigurationPresetHandler } from './get-event-configuration-preset.handler'
import { GetEventConfigurationPresetQuery } from './get-event-configuration-preset.query'

describe('GetEventConfigurationPresetHandler', () => {
  const buildMethod = (provider: string): TenantPayoutMethod =>
    ({
      id: `method-${provider}`,
      provider,
      isActive: true,
      sortOrder: 0,
      status: 'verified',
      receiverIdentifier: null,
      bankName: null,
      accountNumber: null,
      accountType: null,
      accountHolder: null,
      holderIdentification: null,
      verifiedAt: null,
    }) as unknown as TenantPayoutMethod

  const buildProfile = (
    overrides: Partial<Parameters<typeof TenantProfile.fromPersistence>[0]> = {},
  ) =>
    TenantProfile.fromPersistence({
      id: 'profile-1',
      name: 'Team Name',
      publicName: 'Public Name',
      watermarkStorageKey: 'tenants/tenant-1/watermark/v1.png',
      whatsappNumber: '+593999999999',
      whatsappVerifiedAt: new Date('2026-01-01'),
      ...overrides,
    })

  let userRepo: jest.Mocked<IUserReadRepository>
  let profileRepo: jest.Mocked<ITenantProfileRepository>
  let payoutRepo: jest.Mocked<ITenantPayoutMethodRepository>
  let configService: EventConfigurationService
  let cdn: CdnUrlBuilder
  let handler: GetEventConfigurationPresetHandler

  beforeEach(() => {
    userRepo = {
      findTenantId: jest.fn().mockResolvedValue('tenant-1'),
    } as unknown as jest.Mocked<IUserReadRepository>

    profileRepo = {
      findByTenantId: jest.fn().mockResolvedValue(buildProfile()),
    } as unknown as jest.Mocked<ITenantProfileRepository>

    payoutRepo = {
      findByTenantId: jest
        .fn()
        .mockResolvedValue([
          buildMethod(PayoutProvider.PAYPHONE),
          buildMethod(PayoutProvider.BANK_TRANSFER),
        ]),
    } as unknown as jest.Mocked<ITenantPayoutMethodRepository>

    configService = new EventConfigurationService(profileRepo, payoutRepo, {
      get: jest.fn(),
    } as never)
    cdn = {
      watermarkUrl: jest.fn().mockReturnValue('https://cdn.example.com/assets/watermark.png'),
    } as unknown as CdnUrlBuilder

    handler = new GetEventConfigurationPresetHandler(
      userRepo,
      profileRepo,
      payoutRepo,
      configService,
      cdn,
    )
  })

  it('returns the missing list instead of throwing for an empty profile', async () => {
    profileRepo.findByTenantId.mockResolvedValue(null)
    payoutRepo.findByTenantId.mockResolvedValue([])

    const result = await handler.execute(new GetEventConfigurationPresetQuery('user-1'))

    expect(result.missing).toEqual([
      'publicName',
      'watermark',
      'whatsapp',
      'payphone',
      'bankTransfer',
    ])
    expect(result.publicName).toBeNull()
  })

  it('returns an empty missing list and a watermark url for a complete profile', async () => {
    const result = await handler.execute(new GetEventConfigurationPresetQuery('user-1'))

    expect(result.missing).toEqual([])
    expect(result.watermarkUrl).toContain('watermark')
  })

  it('still throws when the actor has no tenant', async () => {
    userRepo.findTenantId.mockResolvedValue(null)
    await expect(handler.execute(new GetEventConfigurationPresetQuery('user-1'))).rejects.toThrow()
  })

  it('reports a whatsapp number that has not been verified', async () => {
    profileRepo.findByTenantId.mockResolvedValue(
      buildProfile({ whatsappNumber: '+593999999999', whatsappVerifiedAt: null }),
    )

    const result = await handler.execute(new GetEventConfigurationPresetQuery('user-1'))

    expect(result.whatsappPendingVerification).toBe(true)
  })
})
