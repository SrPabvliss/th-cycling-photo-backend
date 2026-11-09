import { buildDeliveryTemplate } from './delivery-template'

const context = {
  customerFirstName: 'Andrés',
  photoCount: 3,
  deliveryUrl: 'https://titan.tv/delivery/abc',
}

describe('buildDeliveryTemplate', () => {
  it('announces the confirmed payment on the first delivery', () => {
    const message = buildDeliveryTemplate(context, 'first')

    expect(message).toContain('Andrés')
    expect(message).toContain('3 fotos')
    expect(message).toContain('https://titan.tv/delivery/abc')
    expect(message).toContain('pago fue confirmado')
  })

  it('says the link is a new one when it was regenerated', () => {
    const message = buildDeliveryTemplate(context, 'regenerated')

    expect(message).toContain('nuevo enlace')
    expect(message).not.toContain('pago fue confirmado')
  })

  it('resends the same link without claiming it is new', () => {
    const message = buildDeliveryTemplate(context, 'resend')

    expect(message).toContain('https://titan.tv/delivery/abc')
    expect(message).not.toContain('nuevo enlace')
  })

  it('carries no emoji: the prefill endpoint mangles them on some platforms', () => {
    const everyVariant = (['first', 'regenerated', 'resend'] as const).map((v) =>
      buildDeliveryTemplate(context, v),
    )

    for (const message of everyVariant) {
      expect(message).toMatch(/^[^\p{Extended_Pictographic}]*$/u)
    }
  })
})
