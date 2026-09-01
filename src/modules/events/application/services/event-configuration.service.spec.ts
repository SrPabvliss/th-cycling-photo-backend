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

  const buildGateway = (registered = true) => ({
    provider: 'payphone',
    verifyReceiver: jest.fn().mockResolvedValue(registered),
    platformCredentials: jest.fn().mockReturnValue({}),
    buildCheckoutIntent: jest.fn(),
    confirm: jest.fn(),
    commissionCents: jest.fn(),
  })

  const buildService = (
    profile: TenantProfile | null,
    methods: TenantPayoutMethod[],
    gateway = buildGateway(),
  ) =>
    new EventConfigurationService(
      { findByTenantId: jest.fn().mockResolvedValue(profile), save: jest.fn() },
      {
        findByTenantId: jest.fn().mockResolvedValue(methods),
        findById: jest.fn(),
        findActivePayphoneForTenant: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
      },
      { get: jest.fn().mockReturnValue(gateway) } as never,
      { normalize: jest.fn().mockResolvedValue(undefined) } as never,
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
        payoutMethods: [{ source: 'profile', id: chosen.id }],
      })

      expect(result.payoutMethods).toHaveLength(1)
      expect(result.payoutMethods[0].sourcePayoutMethodId).toBe(chosen.id)
    })

    it('rejects a payout method id belonging to another tenant', async () => {
      const service = buildService(completeProfile(), [payphone(), bank()])

      await expect(
        service.materialise(tenantId, eventId, {
          payoutMethods: [{ source: 'profile', id: crypto.randomUUID() }],
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('rejects a selection that resolves to no active methods', async () => {
      const service = buildService(completeProfile(), [payphone(), bank()])

      await expect(
        service.materialise(tenantId, eventId, { payoutMethods: [] }),
      ).rejects.toMatchObject({ code: 'BUSINESS_RULE' })
    })

    it('rejects a watermark key the tenant does not own', async () => {
      const service = buildService(completeProfile(), [payphone(), bank()])

      await expect(
        service.materialise(tenantId, eventId, {
          watermarkStorageKey: 'tenants/other-tenant/watermark/theirs.png',
        }),
      ).rejects.toThrow('event.watermark_not_owned')
    })
  })

  describe('mixed-origin payout selection', () => {
    const eventId = crypto.randomUUID()

    it('copies a profile method and builds a new one, preserving request order', async () => {
      const chosen = payphone()
      const service = buildService(completeProfile(), [chosen, bank()])

      const result = await service.materialise(tenantId, eventId, {
        payoutMethods: [
          { source: 'profile', id: chosen.id },
          {
            source: 'new',
            provider: 'bank_transfer',
            bankName: 'Banco Pichincha',
            accountNumber: '2100458899',
            accountType: 'Ahorros',
            accountHolder: 'Andres Cepeda Mora',
            holderIdentification: '1712345678',
          },
        ],
      })

      expect(result.payoutMethods).toHaveLength(2)
      expect(result.payoutMethods[0].sourcePayoutMethodId).toBe(chosen.id)
      expect(result.payoutMethods[0].sortOrder).toBe(0)
      expect(result.payoutMethods[1].sourcePayoutMethodId).toBeNull()
      expect(result.payoutMethods[1].bankName).toBe('Banco Pichincha')
      expect(result.payoutMethods[1].sortOrder).toBe(1)
    })

    it('normalizes a new payphone number to the same bare-subscriber format the tenant path stores', async () => {
      const service = buildService(completeProfile(), [])

      const result = await service.materialise(tenantId, eventId, {
        payoutMethods: [{ source: 'new', provider: 'payphone', phone: '+593 99 123 4567' }],
      })

      expect(result.payoutMethods[0].receiverIdentifier).toBe('991234567')
    })

    it('throws when a profile method id does not belong to the tenant', async () => {
      const service = buildService(completeProfile(), [payphone()])

      await expect(
        service.materialise(tenantId, eventId, {
          payoutMethods: [{ source: 'profile', id: 'not-mine' }],
        }),
      ).rejects.toThrow()
    })
  })

  describe('watermark ownership', () => {
    const eventId = crypto.randomUUID()

    it('accepts a key under the actor tenant watermark prefix even when it is not the profile key', async () => {
      const service = buildService(completeProfile(), [payphone(), bank()])

      const result = await service.materialise(tenantId, eventId, {
        watermarkStorageKey: `tenants/${tenantId}/watermark/brand-new.png`,
      })

      expect(result.brand.watermarkStorageKey).toBe(`tenants/${tenantId}/watermark/brand-new.png`)
    })

    it('rejects a key under another tenant prefix', async () => {
      const service = buildService(completeProfile(), [payphone(), bank()])

      await expect(
        service.materialise(tenantId, eventId, {
          watermarkStorageKey: `tenants/${crypto.randomUUID()}/watermark/stolen.png`,
        }),
      ).rejects.toThrow()
    })

    it('rejects a traversal key', async () => {
      const service = buildService(completeProfile(), [payphone(), bank()])

      await expect(
        service.materialise(tenantId, eventId, {
          watermarkStorageKey: `tenants/${tenantId}/watermark/../../other/watermark/x.png`,
        }),
      ).rejects.toThrow()
    })

    it('accepts null, which clears the watermark', async () => {
      const service = buildService(completeProfile(), [payphone(), bank()])

      const result = await service.materialise(tenantId, eventId, { watermarkStorageKey: null })

      expect(result.brand.watermarkStorageKey).toBeNull()
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

    it('keeps an event row byte for byte when the selection says source event', async () => {
      const rebrandedBank = () =>
        TenantPayoutMethod.createBankTransfer(
          tenantId,
          {
            bankName: 'Pichincha Nuevo',
            accountNumber: '9999999999',
            accountType: 'corriente',
            accountHolder: 'Andes Pro',
            holderIdentification: '1804567890',
          },
          null,
        )

      const service = buildService(rebrandedProfile(), [rebrandedBank()])
      const event = frozenEvent()
      const frozenRow = EventPayoutMethod.copyFrom(event.id, bank())

      const result = await service.rematerialise(
        event,
        { payoutMethods: [{ source: 'event', id: frozenRow.id }] },
        [frozenRow],
      )

      expect(result.payoutMethods).toHaveLength(1)
      const kept = result.payoutMethods?.[0]
      expect(kept?.id).toBe(frozenRow.id)
      expect(kept?.bankName).toBe('Pichincha')
      expect(kept?.accountNumber).toBe('2100112233')
      expect(kept?.sourcePayoutMethodId).toBe(frozenRow.sourcePayoutMethodId)
    })

    it('refreshes the row from live profile data when the selection says source profile', async () => {
      const liveBank = bank()
      const service = buildService(rebrandedProfile(), [liveBank])
      const event = frozenEvent()
      const frozenRow = EventPayoutMethod.copyFrom(event.id, bank())

      const result = await service.rematerialise(
        event,
        { payoutMethods: [{ source: 'profile', id: liveBank.id }] },
        [frozenRow],
      )

      expect(result.payoutMethods?.[0]?.id).not.toBe(frozenRow.id)
    })

    it('rejects an event row id that does not belong to the event', async () => {
      const service = buildService(rebrandedProfile(), [bank()])
      const event = frozenEvent()
      const frozenRow = EventPayoutMethod.copyFrom(event.id, bank())

      await expect(
        service.rematerialise(
          event,
          { payoutMethods: [{ source: 'event', id: crypto.randomUUID() }] },
          [frozenRow],
        ),
      ).rejects.toThrow()
    })

    it('never verifies a kept event payphone against the gateway', async () => {
      const gateway = buildGateway()
      const service = buildService(rebrandedProfile(), [payphone()], gateway)
      const event = frozenEvent()
      const frozenRow = EventPayoutMethod.copyFrom(event.id, payphone())

      await service.verifyNewPayphones([{ source: 'event', id: frozenRow.id }])

      expect(gateway.verifyReceiver).not.toHaveBeenCalled()
    })
  })

  describe('verifyNewPayphones', () => {
    it('does nothing when there are no new payphone entries', async () => {
      const gateway = buildGateway()
      const service = buildService(completeProfile(), [], gateway)

      await expect(
        service.verifyNewPayphones([{ source: 'profile', id: 'x' }]),
      ).resolves.toBeUndefined()
      expect(gateway.verifyReceiver).not.toHaveBeenCalled()
    })

    it('verifies every new payphone number against the gateway', async () => {
      const gateway = buildGateway()
      const service = buildService(completeProfile(), [], gateway)

      await service.verifyNewPayphones([
        { source: 'new', provider: 'payphone', phone: '0991234567' },
      ])

      expect(gateway.verifyReceiver).toHaveBeenCalledWith('0991234567', {})
    })

    it('throws payment.phone_not_registered when the gateway cannot verify the number', async () => {
      const gateway = buildGateway(false)
      const service = buildService(completeProfile(), [], gateway)

      await expect(
        service.verifyNewPayphones([{ source: 'new', provider: 'payphone', phone: '0991234567' }]),
      ).rejects.toMatchObject({ messageKey: 'payment.phone_not_registered' })
    })
  })
})
