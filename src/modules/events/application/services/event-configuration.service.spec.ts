import { TenantPayoutMethod } from '@tenants/domain/entities/tenant-payout-method.entity'
import { TenantProfile } from '@tenants/domain/entities/tenant-profile.entity'
import { EventConfigurationService } from './event-configuration.service'

describe('EventConfigurationService', () => {
  const tenantId = crypto.randomUUID()

  const completeProfile = () =>
    TenantProfile.fromPersistence({
      id: tenantId,
      name: 'Foto Andes',
      publicName: 'Foto Andes',
      watermarkStorageKey: 'tenants/foto-andes/watermark.png',
      whatsappNumber: '0991234567',
      whatsappVerifiedAt: null,
    })

  const payphone = () => TenantPayoutMethod.createPayphoneSplit(tenantId, '0991234567', null)
  const bank = () =>
    TenantPayoutMethod.createBankTransfer(
      tenantId,
      {
        bankName: 'Pichincha',
        accountNumber: '2100112233',
        accountType: 'savings',
        accountHolder: 'Ana Perez',
        holderIdentification: '1804567890',
      },
      null,
    )

  const buildService = (profile: TenantProfile | null, methods: TenantPayoutMethod[]) =>
    new EventConfigurationService(
      { findByTenantId: jest.fn().mockResolvedValue(profile), save: jest.fn() },
      {
        findByTenantId: jest.fn().mockResolvedValue(methods),
        findById: jest.fn(),
        findActivePayphoneForTenant: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
      },
    )

  it('reports every missing requirement, not just the first', async () => {
    const service = buildService(
      TenantProfile.fromPersistence({
        id: tenantId,
        name: 'Foto Andes',
        publicName: null,
        watermarkStorageKey: null,
        whatsappNumber: null,
        whatsappVerifiedAt: null,
      }),
      [],
    )

    const missing = await service.findMissingRequirements(tenantId)

    expect(missing).toEqual(['publicName', 'watermark', 'whatsapp', 'payphone', 'bankTransfer'])
  })

  it('passes on a complete profile', async () => {
    const service = buildService(completeProfile(), [payphone(), bank()])

    await expect(service.assertProfileComplete(tenantId)).resolves.toBeUndefined()
  })

  it('accepts a pending payphone method, since verification is out of scope', async () => {
    const pending = payphone()
    expect(pending.isUsable).toBe(false)

    const service = buildService(completeProfile(), [pending, bank()])

    await expect(service.findMissingRequirements(tenantId)).resolves.toEqual([])
  })

  it('ignores inactive methods', async () => {
    const inactive = bank()
    inactive.deactivate()
    const service = buildService(completeProfile(), [payphone(), inactive])

    await expect(service.findMissingRequirements(tenantId)).resolves.toEqual(['bankTransfer'])
  })
})
