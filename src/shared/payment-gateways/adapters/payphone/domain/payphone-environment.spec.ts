import { assertEnvironmentMatchesDeployment, PayphoneEnvironment } from './payphone-environment'

describe('assertEnvironmentMatchesDeployment', () => {
  it('allows production deployments on the production gateway', () => {
    expect(() =>
      assertEnvironmentMatchesDeployment('production', PayphoneEnvironment.PRODUCTION),
    ).not.toThrow()
  })

  it('refuses a production deployment pointed at the test gateway', () => {
    expect(() =>
      assertEnvironmentMatchesDeployment('production', PayphoneEnvironment.TEST),
    ).toThrow(/test/i)
  })

  it('allows development on the test gateway', () => {
    expect(() =>
      assertEnvironmentMatchesDeployment('development', PayphoneEnvironment.TEST),
    ).not.toThrow()
  })

  it('refuses a development deployment pointed at the production gateway', () => {
    expect(() =>
      assertEnvironmentMatchesDeployment('development', PayphoneEnvironment.PRODUCTION),
    ).toThrow(/production/i)
  })
})
