import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { PendingEmailVerificationCodeProjection } from '../../application/projections'
import type { CreateEmailVerificationCodePayload } from '../../domain/payloads'
import type { IEmailVerificationCodeRepository } from '../../domain/ports'

@Injectable()
export class EmailVerificationCodeRepository implements IEmailVerificationCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: CreateEmailVerificationCodePayload): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationCode.updateMany({
        where: { user_id: payload.userId, consumed_at: null },
        data: { consumed_at: new Date() },
      })

      await tx.emailVerificationCode.create({
        data: {
          id: payload.id,
          user_id: payload.userId,
          purpose: payload.purpose,
          target_email: payload.targetEmail,
          code_hash: payload.codeHash,
          expires_at: payload.expiresAt,
        },
      })
    })
  }

  async findLatestUnconsumedByUser(
    userId: string,
  ): Promise<PendingEmailVerificationCodeProjection | null> {
    const record = await this.prisma.emailVerificationCode.findFirst({
      where: { user_id: userId, consumed_at: null },
      orderBy: { created_at: 'desc' },
    })

    if (!record) return null

    return {
      id: record.id,
      userId: record.user_id,
      purpose: record.purpose,
      targetEmail: record.target_email,
      codeHash: record.code_hash,
      expiresAt: record.expires_at,
      consumedAt: record.consumed_at,
      attempts: record.attempts,
      createdAt: record.created_at,
    }
  }

  async registerAttempt(id: string): Promise<number> {
    const record = await this.prisma.emailVerificationCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    })

    return record.attempts
  }

  async consume(userId: string): Promise<void> {
    await this.prisma.emailVerificationCode.updateMany({
      where: { user_id: userId, consumed_at: null },
      data: { consumed_at: new Date() },
    })
  }

  async countSentSince(userId: string, since: Date): Promise<number> {
    return this.prisma.emailVerificationCode.count({
      where: { user_id: userId, created_at: { gte: since } },
    })
  }
}
