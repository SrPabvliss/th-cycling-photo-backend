import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { StoredRefreshTokenProjection } from '../../application/projections'
import type { IRefreshTokenRepository } from '../../domain/ports'

@Injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        token_hash: data.tokenHash,
        user_id: data.userId,
        expires_at: data.expiresAt,
      },
    })
  }

  async findByHash(tokenHash: string): Promise<StoredRefreshTokenProjection | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: { include: { user_roles: { include: { role: true } } } } },
    })

    if (!record) return null

    return {
      userId: record.user.id,
      email: record.user.email,
      role: record.user.user_roles[0]?.role.name ?? 'classifier',
      isActive: record.user.is_active,
      revokedAt: record.revoked_at,
      expiresAt: record.expires_at,
    }
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { token_hash: tokenHash, revoked_at: null },
      data: { revoked_at: new Date() },
    })
  }
}
