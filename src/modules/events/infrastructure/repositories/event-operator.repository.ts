import type {
  EventOperatorProjection,
  IEventOperatorRepository,
} from '@events/domain/ports/event-operator-repository.port'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { PermissionKey } from '@shared/authorization/domain/permission-catalog'

const OPERATOR_PERMISSIONS: PermissionKey[] = [
  'photo.retouch.read',
  'photo.retouch.upload',
  'photo.retouch.flag',
]

@Injectable()
export class EventOperatorRepository implements IEventOperatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assign(eventId: string, userId: string, assignedById: string): Promise<void> {
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: OPERATOR_PERMISSIONS as string[] } },
      select: { id: true, key: true },
    })

    const data = permissions.map((p) => ({
      user_id: userId,
      permission_id: p.id,
      scope_type: 'event' as const,
      event_id: eventId,
      effect: 'allow' as const,
      granted_by_id: assignedById,
    }))

    // Use raw query for unique constraint or just createMany (it will fail on conflict)
    // but the handler checks isAssigned beforehand, so createMany is safe.
    await this.prisma.userPermissionGrant.createMany({
      data,
      skipDuplicates: true,
    })
  }

  async unassign(eventId: string, userId: string): Promise<void> {
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: OPERATOR_PERMISSIONS as string[] } },
      select: { id: true },
    })
    
    await this.prisma.userPermissionGrant.deleteMany({
      where: {
        event_id: eventId,
        user_id: userId,
        permission_id: { in: permissions.map(p => p.id) },
      },
    })
  }

  async findByEvent(eventId: string): Promise<EventOperatorProjection[]> {
    // A user is considered assigned if they have the photo.retouch.read grant for the event.
    const records = await this.prisma.userPermissionGrant.findMany({
      where: {
        event_id: eventId,
        permission: { key: 'photo.retouch.read' },
      },
      include: { user: { select: { id: true, email: true, first_name: true, last_name: true } } },
      orderBy: { granted_at: 'asc' },
    })

    return records.map((r) => ({
      id: r.id, // using grant id as a proxy for the 'assignment' id
      eventId: r.event_id!,
      userId: r.user.id,
      email: r.user.email,
      firstName: r.user.first_name,
      lastName: r.user.last_name,
      assignedAt: r.granted_at,
    }))
  }

  async isAssigned(eventId: string, userId: string): Promise<boolean> {
    const record = await this.prisma.userPermissionGrant.findFirst({
      where: {
        event_id: eventId,
        user_id: userId,
        permission: { key: 'photo.retouch.read' },
      },
      select: { id: true },
    })
    return record !== null
  }

  async findFirstOperatorId(): Promise<string | null> {
    // Wait, the original findFirstOperatorId used user_roles.
    // Let's replace it with users on the platform_staff template.
    const user = await this.prisma.user.findFirst({
      where: {
        is_active: true,
        permission_template: { key: 'platform_staff' }
      },
      select: { id: true },
      orderBy: { created_at: 'asc' },
    })
    return user?.id ?? null
  }
}
