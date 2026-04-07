import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { StoredRefreshTokenProjection } from '../../application/projections'
import type { CreateRefreshTokenPayload } from '../../domain/payloads'
import type { IRefreshTokenRepository } from '../../domain/ports'

@Injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: CreateRefreshTokenPayload): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        token_hash: payload.tokenHash,
        user_id: payload.userId,
        expires_at: payload.expiresAt,
        ip_address: payload.ipAddress ?? null,
        user_agent: payload.userAgent ?? null,
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
      role: record.user.user_roles[0]?.role.name ?? 'operator',
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
