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

  it('keeps only the first word, because the greeting is informal', () => {
    expect(customerFirstName({ snapFirstName: 'Ana María' })).toBe('Ana')
  })

  it('returns an empty string when there is no name at all', () => {
    expect(customerFirstName({})).toBe('')
  })
})
