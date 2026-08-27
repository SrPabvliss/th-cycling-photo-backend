import { CONSENT_TYPE, POLICY_VERSIONS, REQUIRED_CONSENT_TYPES } from './consent.constants'

describe('consent.constants', () => {
  it('keeps the buyer policy version independent of the tenant one', () => {
    expect(POLICY_VERSIONS[CONSENT_TYPE.TERMS_PRIVACY]).toBe('2026-08-16')
    expect(POLICY_VERSIONS[CONSENT_TYPE.TERMS_TENANT]).toBe('2026-08-23')
  })

  it('does not force the tenant terms on everyone', () => {
    expect(REQUIRED_CONSENT_TYPES).not.toContain(CONSENT_TYPE.TERMS_TENANT)
  })
})
