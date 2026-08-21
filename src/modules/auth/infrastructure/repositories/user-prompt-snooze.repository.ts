import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { UserPromptSnoozeProjection } from '../../application/projections'
import type { IUserPromptSnoozeRepository } from '../../domain/ports'

@Injectable()
export class UserPromptSnoozeRepository implements IUserPromptSnoozeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async snooze(userId: string, promptKey: string, until: Date): Promise<void> {
    await this.prisma.userPromptSnooze.upsert({
      where: { user_id_prompt_key: { user_id: userId, prompt_key: promptKey } },
      create: { user_id: userId, prompt_key: promptKey, snoozed_until: until },
      update: { snoozed_until: until, created_at: new Date() },
    })
  }

  async findByUser(userId: string): Promise<UserPromptSnoozeProjection[]> {
    const rows = await this.prisma.userPromptSnooze.findMany({
      where: { user_id: userId },
    })

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      promptKey: row.prompt_key,
      snoozedUntil: row.snoozed_until,
      createdAt: row.created_at,
    }))
  }

  async lastSnoozedAt(userId: string): Promise<Date | null> {
    const record = await this.prisma.userPromptSnooze.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    })

    return record?.created_at ?? null
  }
}
