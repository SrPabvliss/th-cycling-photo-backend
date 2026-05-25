import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { EventTypeProjection } from '../../application/projections'
import type { IEventTypeReadRepository } from '../../domain/ports'

@Injectable()
export class EventTypeReadRepository implements IEventTypeReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<EventTypeProjection[]> {
    const rows = await this.prisma.eventType.findMany({
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    })
    return rows.map((row) => ({ id: row.id, name: row.name }))
  }
}
