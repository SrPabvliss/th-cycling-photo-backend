import type { PrismaClient } from '@generated/prisma/client'

/**
 * Resolves TitanTV's own platform tenant id. Events created directly through
 * Prisma in tests represent TitanTV's own events, so they belong to the
 * platform tenant rather than a hardcoded UUID.
 */
export async function getPlatformTenantId(prisma: PrismaClient): Promise<string> {
  const tenant = await prisma.tenant.findFirstOrThrow({
    where: { is_platform: true },
    select: { id: true },
  })
  return tenant.id
}
