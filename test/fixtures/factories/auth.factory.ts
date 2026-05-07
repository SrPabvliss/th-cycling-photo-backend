import { PrismaClient } from '@generated/prisma/client'
import { JwtService } from '@nestjs/jwt'
import { hashSync } from 'bcryptjs'

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

  const user = await prisma.user.create({
    data: {
      email,
      password_hash: hashSync('test-password-not-real', 10),
      first_name: 'E2E',
      last_name: role,
      is_active: true,
    },
    select: { id: true, email: true },
  })

  const dbRole = await prisma.role.findUnique({ where: { name: role } })
  if (dbRole) {
    await prisma.userRole.create({ data: { user_id: user.id, role_id: dbRole.id } })
  }

  const token = jwt.sign({ sub: user.id, email: user.email, role })

  return { userId: user.id, email: user.email, role, token }
}
