import type { PrismaClient } from '@generated/prisma/client'

/**
 * The application refuses to start unless `PAYMENT_SYSTEM_USER_EMAIL` names an existing user
 * (see `PaymentSystemActor`). Suites that truncate `users` leave the next one unable to boot, so
 * every spec that starts the whole `AppModule` makes sure the account is there first.
 */
export async function ensurePaymentSystemUser(prisma: PrismaClient): Promise<void> {
  const email = process.env.PAYMENT_SYSTEM_USER_EMAIL
  if (!email) throw new Error('PAYMENT_SYSTEM_USER_EMAIL is not set for the test run')

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password_hash: 'test-hash-not-real',
      first_name: 'Payment',
      last_name: 'System',
      is_active: true,
    },
  })
}
