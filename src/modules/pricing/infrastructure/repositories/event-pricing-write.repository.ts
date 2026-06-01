import { Prisma } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import type { IEventPricingWriteRepository, RawPricingConfig } from '@pricing/domain/ports'
import { PrismaService } from '@shared/infrastructure'

@Injectable()
export class EventPricingWriteRepository implements IEventPricingWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertConfig(eventId: string, config: RawPricingConfig): Promise<void> {
    await this.prisma.event.update({
      where: { id: eventId },
      data: { pricing_config: config as unknown as object },
    })
  }

  async deleteConfig(eventId: string): Promise<void> {
    await this.prisma.event.update({
      where: { id: eventId },
      data: { pricing_config: Prisma.DbNull },
    })
  }
}
