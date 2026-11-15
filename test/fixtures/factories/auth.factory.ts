import { PrismaClient } from '@generated/prisma/client'
import { JwtService } from '@nestjs/jwt'
import { hashSync } from 'bcryptjs'
import { getPlatformTenantId } from './tenant.factory'

const TEMPLATE_BY_ROLE = {
  admin: 'platform_admin',
  operator: 'platform_staff',
  customer: 'customer',
} as const

export interface TestAuthUser {
  userId: string
  email: string
  role: 'admin' | 'operator' | 'customer'
  token: string
}

/**
 * Creates a real user in the test DB with the given role and returns a JWT
 * signed by the running app's JwtService. Bypasses the login endpoint to keep
 * setup deterministic — we test endpoint authorization, not the auth flow.
 */
export async function createAuthenticatedUser(
  prisma: PrismaClient,
  jwt: JwtService,
  role: 'admin' | 'operator' | 'customer' = 'admin',
): Promise<TestAuthUser> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `e2e-${role}-${stamp}@test.local`

  // Same wiring the seed gives each role: without a permission template every permissioned route
  // answers 403, and staff additionally need the platform tenant to resolve any permission at all.
  const template = await prisma.permissionTemplate.findUniqueOrThrow({
    where: { key: TEMPLATE_BY_ROLE[role] },
    select: { id: true },
  })
  const tenantId = role === 'customer' ? null : await getPlatformTenantId(prisma)

  const user = await prisma.user.create({
    data: {
      email,
      password_hash: hashSync('test-password-not-real', 10),
      first_name: 'E2E',
      last_name: role,
      is_active: true,
      tenant_id: tenantId,
      permission_template_id: template.id,
    },
    select: { id: true, email: true },
  })

  const dbRole = await prisma.role.findUnique({ where: { name: role } })
  if (dbRole) {
    await prisma.userRole.create({ data: { user_id: user.id, role_id: dbRole.id } })
  }

  const token = jwt.sign({ sub: user.id, email: user.email, role, pv: 0 })

  return { userId: user.id, email: user.email, role, token }
}
