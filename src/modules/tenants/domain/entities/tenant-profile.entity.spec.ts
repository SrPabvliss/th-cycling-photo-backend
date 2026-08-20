import { TenantProfile } from './tenant-profile.entity'

const base = {
  id: 't1',
  name: 'Fotos Andes',
  publicName: null,
  watermarkStorageKey: null,
  whatsappNumber: '0984112233',
  whatsappVerifiedAt: new Date('2026-01-01'),
}

describe('TenantProfile.changeWhatsapp', () => {
  it('marks a new number pending verification', () => {
    const profile = TenantProfile.fromPersistence(base)

    profile.changeWhatsapp('0999888777')

    expect(profile.whatsappNumber).toBe('0999888777')
    expect(profile.whatsappVerifiedAt).toBeNull()
  })

  it('keeps verification when the number is unchanged', () => {
    const profile = TenantProfile.fromPersistence(base)

    profile.changeWhatsapp('0984112233')

    expect(profile.whatsappVerifiedAt).toEqual(base.whatsappVerifiedAt)
  })

  it('clears the number and its verification', () => {
    const profile = TenantProfile.fromPersistence(base)

    profile.changeWhatsapp(null)

    expect(profile.whatsappNumber).toBeNull()
    expect(profile.whatsappVerifiedAt).toBeNull()
  })
})
