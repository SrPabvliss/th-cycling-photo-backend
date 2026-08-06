import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { StoredPasswordResetTokenProjection } from '../../application/projections'
import type { CreatePasswordResetTokenPayload } from '../../domain/payloads'
import type { IPasswordResetTokenRepository } from '../../domain/ports'

@Injectable()
export class PasswordResetTokenRepository implements IPasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: CreatePasswordResetTokenPayload): Promise<void> {
    await this.prisma.passwordResetToken.create({
      data: {
        id: payload.id,
        user_id: payload.userId,
        token_hash: payload.tokenHash,
        expires_at: payload.expiresAt,
        ip: payload.ipAddress,
        user_agent: payload.userAgent,
      },
    })
  }

  async findById(id: string): Promise<StoredPasswordResetTokenProjection | null> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { id },
      include: { user: { select: { email: true, first_name: true, is_active: true } } },
    })

    if (!record) return null

    return {
      id: record.id,
      userId: record.user_id,
      tokenHash: record.token_hash,
      expiresAt: record.expires_at,
      usedAt: record.used_at,
      isActive: record.user.is_active,
      email: record.user.email,
      firstName: record.user.first_name,
    }
  }

  async findLastCreatedAtForUser(userId: string): Promise<Date | null> {
    const record = await this.prisma.passwordResetToken.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    })

    return record?.created_at ?? null
  }

  async consumeAndUpdatePassword(
    tokenId: string,
    userId: string,
    passwordHash: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: tokenId, used_at: null },
        data: { used_at: new Date() },
      })

      if (consumed.count === 0) return false

      await tx.passwordResetToken.updateMany({
        where: { user_id: userId, used_at: null },
        data: { used_at: new Date() },
      })

      await tx.user.update({
        where: { id: userId },
        data: { password_hash: passwordHash },
      })

      await tx.refreshToken.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
      })

      return true
    })
  }
}
