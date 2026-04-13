import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { RetouchQueueProjection } from '../../application/projections'
import type { IOperatorRetouchRepository } from '../../domain/ports'
import * as RetouchMapper from '../mappers/retouch-queue.mapper'

@Injectable()
export class OperatorRetouchRepository implements IOperatorRetouchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getRetouchQueue(eventId: string): Promise<RetouchQueueProjection> {
    const orders = await this.prisma.order.findMany({
      where: {
        event_id: eventId,
        status: 'paid',
        items: { some: { photo: { retouched_at: null } } },
      },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        snap_first_name: true,
        snap_last_name: true,
        created_at: true,
        items: {
          select: {
            photo: {
              select: {
                id: true,
                storage_key: true,
                public_slug: true,
                retouched_storage_key: true,
              },
            },
          },
        },
      },
    })

    return RetouchMapper.toRetouchQueueProjection(orders)
  }

  async isOperatorAssigned(eventId: string, operatorId: string): Promise<boolean> {
    const record = await this.prisma.eventOperator.findUnique({
      where: { event_id_user_id: { event_id: eventId, user_id: operatorId } },
      select: { id: true },
    })
    return record !== null
  }
}
