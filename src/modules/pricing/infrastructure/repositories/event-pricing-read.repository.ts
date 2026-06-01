import { Injectable } from '@nestjs/common'
import type { IEventPricingReadRepository, RawPricingConfig } from '@pricing/domain/ports'
import { PrismaService } from '@shared/infrastructure'

@Injectable()
export class EventPricingReadRepository implements IEventPricingReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findConfigByEventId(eventId: string): Promise<RawPricingConfig | null> {
    const row = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { pricing_config: true },
    })
    if (!row || row.pricing_config === null) return null
    return row.pricing_config as unknown as RawPricingConfig
  }
}
