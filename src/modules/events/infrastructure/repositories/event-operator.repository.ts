import type {
  EventOperatorProjection,
  IEventOperatorRepository,
} from '@events/domain/ports/event-operator-repository.port'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'

@Injectable()
export class EventOperatorRepository implements IEventOperatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assign(eventId: string, userId: string, assignedById: string): Promise<void> {
    await this.prisma.eventOperator.create({
      data: {
        event_id: eventId,
        user_id: userId,
        assigned_by_id: assignedById,
      },
    })
  }

  async unassign(eventId: string, userId: string): Promise<void> {
    await this.prisma.eventOperator.deleteMany({
      where: { event_id: eventId, user_id: userId },
    })
  }

  async findByEvent(eventId: string): Promise<EventOperatorProjection[]> {
    const records = await this.prisma.eventOperator.findMany({
      where: { event_id: eventId },
      include: { user: { select: { id: true, email: true, first_name: true, last_name: true } } },
      orderBy: { assigned_at: 'asc' },
    })

    return records.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      userId: r.user.id,
      email: r.user.email,
      firstName: r.user.first_name,
      lastName: r.user.last_name,
      assignedAt: r.assigned_at,
    }))
  }

  async isAssigned(eventId: string, userId: string): Promise<boolean> {
    const record = await this.prisma.eventOperator.findUnique({
      where: { event_id_user_id: { event_id: eventId, user_id: userId } },
      select: { id: true },
    })
    return record !== null
  }

  async findFirstOperatorId(): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        is_active: true,
        user_roles: { some: { role: { name: 'operator' } } },
      },
      select: { id: true },
      orderBy: { created_at: 'asc' },
    })
    return user?.id ?? null
  }
}
