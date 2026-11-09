import { buildPaymentInfoTemplate } from '@orders/domain/services/payment-info-template'

describe('payment info template', () => {
  const base = {
    customerFirstName: 'Andrés',
    eventName: 'Downhill Lumbisí',
    photoCount: 3,
    subtotal: 9,
    currency: 'USD',
  }

  it('tells the buyer to transfer to the account frozen on the event', () => {
    const message = buildPaymentInfoTemplate({
      ...base,
      account: {
        bankName: 'Cooperativa JEP',
        accountType: 'corriente',
        accountNumber: '12346532352',
        accountHolder: 'TEST ACCOUNT EDIT',
        holderIdentification: '1850046371',
      },
    })

    expect(message).toContain('Cooperativa JEP')
    expect(message).toContain('12346532352')
    expect(message).toContain('TEST ACCOUNT EDIT')
    expect(message).not.toContain('Pichincha')
  })

  it('says nothing rather than inventing an account when the event has none', () => {
    const message = buildPaymentInfoTemplate({ ...base, account: null })

    expect(message).not.toContain('Número:')
    expect(message).toContain('en un momento')
  })

  it('leaves the price for the operator to fill when the order has no subtotal', () => {
    const message = buildPaymentInfoTemplate({ ...base, subtotal: null, account: null })

    expect(message).toContain('[ESCRIBE EL PRECIO AQUÍ]')
  })
})
