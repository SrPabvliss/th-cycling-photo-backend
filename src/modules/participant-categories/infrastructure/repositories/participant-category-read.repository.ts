import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import type { IParticipantCategoryReadRepository } from '../../domain/ports'
import type { ParticipantCategoryProjection } from '../../domain/projections'

@Injectable()
export class ParticipantCategoryReadRepository implements IParticipantCategoryReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEventType(eventTypeId: number): Promise<ParticipantCategoryProjection[]> {
    return this.prisma.participantCategory.findMany({
      where: { event_type_id: eventTypeId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  }
}
