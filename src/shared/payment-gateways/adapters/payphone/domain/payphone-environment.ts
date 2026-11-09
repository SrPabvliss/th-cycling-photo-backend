export const PayphoneEnvironment = {
  TEST: 'test',
  PRODUCTION: 'production',
} as const

export type PayphoneEnvironmentType = (typeof PayphoneEnvironment)[keyof typeof PayphoneEnvironment]

export function assertEnvironmentMatchesDeployment(nodeEnv: string, payphoneEnv: string): void {
  const isProductionDeployment = nodeEnv === 'production'
  const isProductionGateway = payphoneEnv === PayphoneEnvironment.PRODUCTION

  if (isProductionDeployment && !isProductionGateway) {
    throw new Error(
      'PAYPHONE_ENVIRONMENT is set to test while NODE_ENV is production. Payments would be approved without charging anyone.',
    )
  }

  if (!isProductionDeployment && isProductionGateway) {
    throw new Error(
      'PAYPHONE_ENVIRONMENT is set to production outside a production deployment. Real cards would be charged.',
    )
  }
}
