import { TenantProfile } from './tenant-profile.entity'

const base = {
  id: 't1',
  name: 'Fotos Andes',
  publicName: null,
  watermarkStorageKey: null,
  whatsappNumber: '0984112233',
  whatsappVerifiedAt: new Date('2026-01-01'),
}

const branded = { ...base, publicName: 'Fotos Andes Pro', watermarkStorageKey: 'watermarks/t1.png' }

describe('TenantProfile.changeBrand', () => {
  it('leaves publicName and watermarkStorageKey untouched when both are undefined', () => {
    const profile = TenantProfile.fromPersistence(branded)

    profile.changeBrand(undefined, undefined)

    expect(profile.publicName).toBe('Fotos Andes Pro')
    expect(profile.watermarkStorageKey).toBe('watermarks/t1.png')
  })

  it('clears publicName and watermarkStorageKey when both are explicitly null', () => {
    const profile = TenantProfile.fromPersistence(branded)

    profile.changeBrand(null, null)

    expect(profile.publicName).toBeNull()
    expect(profile.watermarkStorageKey).toBeNull()
  })
})

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
