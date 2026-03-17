import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { AuthUserProjection } from '../../application/projections'
import type { IAuthUserRepository } from '../../domain/ports'

@Injectable()
export class AuthUserRepository implements IAuthUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<AuthUserProjection | null> {
    const record = await this.prisma.user.findFirst({
      where: { email },
      include: { user_roles: { include: { role: true } } },
    })

    if (!record) return null

    return {
      id: record.id,
      email: record.email,
      passwordHash: record.password_hash,
      isActive: record.is_active,
      role: record.user_roles[0]?.role.name ?? 'classifier',
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { last_login_at: new Date() },
    })
  }
}
