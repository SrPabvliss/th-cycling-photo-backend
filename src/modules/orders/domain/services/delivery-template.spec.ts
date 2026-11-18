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

  it('points a paid order to the invoice in the email', () => {
    const message = buildDeliveryTemplate({ ...context, invoiced: true }, 'first')

    expect(message).toContain('Revisa tu correo: ahí te enviamos tu factura.')
  })

  it('mentions no invoice when the order was not paid, or on a later message', () => {
    expect(buildDeliveryTemplate(context, 'first')).not.toContain('factura')
    expect(buildDeliveryTemplate({ ...context, invoiced: true }, 'resend')).not.toContain('factura')
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
