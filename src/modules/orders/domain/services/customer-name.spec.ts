import { customerFirstName } from './customer-name'

describe('customerFirstName', () => {
  it('prefers the name frozen on the order over the current account name', () => {
    expect(customerFirstName({ snapFirstName: 'Andrés', userName: 'Pablo Villacrés' })).toBe(
      'Andrés',
    )
  })

  it('falls back to the account name when the order froze none', () => {
    expect(customerFirstName({ snapFirstName: null, userName: 'Pablo Villacrés' })).toBe('Pablo')
  })

  it('keeps every given name of the frozen name', () => {
    expect(customerFirstName({ snapFirstName: 'Juan Carlos' })).toBe('Juan Carlos')
  })

  it('falls back to the account name when the frozen name is blank', () => {
    expect(customerFirstName({ snapFirstName: '  ', userName: 'Pablo Villacrés' })).toBe('Pablo')
  })

  it('returns an empty string when there is no name at all', () => {
    expect(customerFirstName({})).toBe('')
  })
})
