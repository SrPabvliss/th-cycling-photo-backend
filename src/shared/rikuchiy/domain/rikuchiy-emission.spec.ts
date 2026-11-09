import type { InvoiceSource } from './ports/invoice-source-reader.port'
import { RikuchiyEmission } from './rikuchiy-emission'

describe('RikuchiyEmission', () => {
  const ORDER_ID = '6573069a-1b2c-4d5e-8f90-123456789abc'

  const source = (overrides: Partial<InvoiceSource> = {}): InvoiceSource => ({
    orderId: ORDER_ID,
    status: 'paid',
    subtotal: '6.00',
    billing: {
      idType: 'national_id',
      idNumber: '1710034065',
      legalName: 'Juan Pérez',
      email: 'juan@correo.com',
      address: null,
    },
    consent: { givenAt: new Date('2026-11-03T15:00:00Z'), ip: '190.1.1.1' },
    eventName: 'Downhill Teleférico',
    eventDate: new Date('2026-08-29T00:00:00Z'),
    items: [
      { filename: 'DH-001.jpg', unitPrice: '3.00' },
      { filename: 'DH-002.JPG', unitPrice: '3.00' },
    ],
    ...overrides,
  })

  const payloadOf = (invoiceSource: InvoiceSource) => {
    const build = RikuchiyEmission.build(invoiceSource, {
      emissionId: 'emission-1',
      externalRef: invoiceSource.orderId,
    })
    if (build.kind !== 'payload') throw new Error(`expected a payload, got ${build.reason}`)
    return build.payload
  }

  const skipReasonOf = (invoiceSource: InvoiceSource) => {
    const build = RikuchiyEmission.build(invoiceSource, {
      emissionId: 'emission-1',
      externalRef: invoiceSource.orderId,
    })
    return build.kind === 'skip' ? build.reason : 'payload'
  }

  it('writes one FOTO line per photo with the filename without extension', () => {
    const payload = payloadOf(source())

    expect(payload.lines).toEqual([
      {
        code: 'FOTO',
        description: 'Fotografía digital',
        quantity: 1,
        grossPrice: '3.00',
        additionalDetails: [{ name: 'Archivo', value: 'DH-001' }],
      },
      {
        code: 'FOTO',
        description: 'Fotografía digital',
        quantity: 1,
        grossPrice: '3.00',
        additionalDetails: [{ name: 'Archivo', value: 'DH-002' }],
      },
    ])
  })

  it('names the event, its date and the order once', () => {
    expect(payloadOf(source()).additionalInfo).toEqual([
      { name: 'Evento', value: 'Downhill Teleférico' },
      { name: 'Fecha del evento', value: '29/08/2026' },
      { name: 'Pedido', value: '6573069a' },
    ])
  })

  it('issues the sale to the frozen buyer with its SRI identification code', () => {
    const payload = payloadOf(source())

    expect(payload.emissionId).toBe('emission-1')
    expect(payload.sale).toEqual({ app: 'cycling-photo', externalRef: ORDER_ID })
    expect(payload.buyer).toEqual({
      idType: '05',
      idNumber: '1710034065',
      legalName: 'Juan Pérez',
      address: null,
      email: 'juan@correo.com',
      phone: null,
    })
    expect(payload.total).toBe('6.00')
    expect(payload.paymentMethod).toBe('20')
    expect(payload.consent).toEqual({ givenAt: '2026-11-03T15:00:00.000Z', ip: '190.1.1.1' })
  })

  it('maps RUC and passport to their SRI codes', () => {
    const ruc = source({
      billing: { ...source().billing!, idType: 'ruc', idNumber: '1790012345001' },
    })
    const passport = source({ billing: { ...source().billing!, idType: 'passport' } })

    expect(payloadOf(ruc).buyer.idType).toBe('04')
    expect(payloadOf(passport).buyer.idType).toBe('06')
  })

  it.each(['gifted', 'cancelled', 'pending'])('skips an order that is %s', (status) => {
    expect(skipReasonOf(source({ status }))).toBe('not_a_sale')
  })

  it.each([null, '0.00'])('skips an order whose subtotal is %s', (subtotal) => {
    expect(skipReasonOf(source({ subtotal }))).toBe('not_a_sale')
  })

  it('invoices a delivered order', () => {
    expect(skipReasonOf(source({ status: 'delivered' }))).toBe('payload')
  })

  it('skips an order without billing data', () => {
    expect(skipReasonOf(source({ billing: null }))).toBe('no_billing_data')
  })

  it('skips an order without a usable invoice consent', () => {
    expect(skipReasonOf(source({ consent: null }))).toBe('no_invoice_consent')
    expect(
      skipReasonOf(source({ consent: { givenAt: new Date('2026-11-03T15:00:00Z'), ip: null } })),
    ).toBe('no_invoice_consent')
  })

  it('skips an order with a photo without price', () => {
    const items = [
      { filename: 'DH-001.jpg', unitPrice: '3.00' },
      { filename: 'DH-002.jpg', unitPrice: null },
    ]
    expect(skipReasonOf(source({ items }))).toBe('missing_unit_price')
  })

  it('skips an order whose lines do not add up to what was charged', () => {
    const items = [
      { filename: 'DH-001.jpg', unitPrice: '3.00' },
      { filename: 'DH-002.jpg', unitPrice: '2.99' },
    ]
    expect(skipReasonOf(source({ items }))).toBe('total_mismatch')
  })

  it('adds cents exactly where floats would drift', () => {
    const items = [
      { filename: 'a.jpg', unitPrice: '0.10' },
      { filename: 'b.jpg', unitPrice: '0.20' },
    ]
    expect(payloadOf(source({ items, subtotal: '0.30' })).total).toBe('0.30')
  })

  it('derives the sale reference from the annulments already made', () => {
    expect(RikuchiyEmission.externalRefOf(ORDER_ID, 0)).toBe(ORDER_ID)
    expect(RikuchiyEmission.externalRefOf(ORDER_ID, 1)).toBe(`${ORDER_ID}-2`)
    expect(RikuchiyEmission.externalRefOf(ORDER_ID, 2)).toBe(`${ORDER_ID}-3`)
  })

  it('writes the received sale reference into the payload', () => {
    const build = RikuchiyEmission.build(source(), {
      emissionId: 'emission-1',
      externalRef: `${ORDER_ID}-2`,
    })
    if (build.kind !== 'payload') throw new Error('expected a payload')
    expect(build.payload.sale.externalRef).toBe(`${ORDER_ID}-2`)
  })
})
