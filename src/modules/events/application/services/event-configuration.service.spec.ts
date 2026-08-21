import { EventPayoutMethod } from '@events/domain/entities'
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

  describe('materialise', () => {
    const eventId = crypto.randomUUID()

    it('copies the whole profile when no selection is given', async () => {
      const service = buildService(completeProfile(), [payphone(), bank()])

      const result = await service.materialise(tenantId, eventId)

      expect(result.brand.publicName).toBe('Foto Andes')
      expect(result.payoutMethods).toHaveLength(2)
    })

    it('applies brand overrides without touching the profile', async () => {
      const profile = completeProfile()
      const service = buildService(profile, [payphone(), bank()])

      const result = await service.materialise(tenantId, eventId, {
        publicName: 'Foto Andes — Cotopaxi',
      })

      expect(result.brand.publicName).toBe('Foto Andes — Cotopaxi')
      expect(profile.publicName).toBe('Foto Andes')
    })

    it('clears a brand field when the selection passes an explicit null', async () => {
      const service = buildService(completeProfile(), [payphone(), bank()])

      const result = await service.materialise(tenantId, eventId, { publicName: null })

      expect(result.brand.publicName).toBeNull()
      expect(result.brand.whatsappNumber).toBe('0991234567')
    })

    it('copies only the selected payout methods', async () => {
      const chosen = payphone()
      const service = buildService(completeProfile(), [chosen, bank()])

      const result = await service.materialise(tenantId, eventId, {
        payoutMethodIds: [chosen.id],
      })

      expect(result.payoutMethods).toHaveLength(1)
      expect(result.payoutMethods[0].sourcePayoutMethodId).toBe(chosen.id)
    })

    it('rejects a payout method id belonging to another tenant', async () => {
      const service = buildService(completeProfile(), [payphone(), bank()])

      await expect(
        service.materialise(tenantId, eventId, { payoutMethodIds: [crypto.randomUUID()] }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('rejects a selection that resolves to no active methods', async () => {
      const service = buildService(completeProfile(), [payphone(), bank()])

      await expect(
        service.materialise(tenantId, eventId, { payoutMethodIds: [] }),
      ).rejects.toMatchObject({ code: 'BUSINESS_RULE' })
    })
  })

  describe('rematerialise', () => {
    // The profile has since been rebranded; a partial edit must not drag those values in.
    const rebrandedProfile = () =>
      TenantProfile.fromPersistence({
        id: tenantId,
        name: 'Foto Andes',
        publicName: 'Andes Pro',
        watermarkStorageKey: 'tenants/andes-pro/watermark.png',
        whatsappNumber: '0988888888',
        whatsappVerifiedAt: null,
      })

    const frozenEvent = () => ({
      id: crypto.randomUUID(),
      tenantId,
      snapPublicName: 'Foto Andes',
      snapWatermarkStorageKey: 'tenants/foto-andes/watermark.png',
      snapWhatsappNumber: '0991234567',
    })

    it('keeps omitted brand fields at the event snapshot, not the current profile', async () => {
      const service = buildService(rebrandedProfile(), [payphone(), bank()])
      const event = frozenEvent()

      const result = await service.rematerialise(event, { whatsappNumber: '0999999999' }, [
        EventPayoutMethod.copyFrom(event.id, bank()),
      ])

      expect(result.brand).toEqual({
        publicName: 'Foto Andes',
        watermarkStorageKey: 'tenants/foto-andes/watermark.png',
        whatsappNumber: '0999999999',
      })
      expect(result.payoutMethods).toBeNull()
    })
  })
})
