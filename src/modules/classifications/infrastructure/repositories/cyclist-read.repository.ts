import type {
  ParticipantDetailProjection,
  ParticipantListProjection,
} from '@classifications/application/projections'
import type { DetectedParticipant } from '@classifications/domain/entities'
import type { IParticipantReadRepository } from '@classifications/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import * as ParticipantMapper from '../mappers/cyclist.mapper'

@Injectable()
export class ParticipantReadRepository implements IParticipantReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds a detected participant entity by ID. */
  async findById(id: string): Promise<DetectedParticipant | null> {
    const record = await this.prisma.detectedParticipant.findFirst({ where: { id } })
    return record ? ParticipantMapper.toEntity(record) : null
  }

  /** Retrieves all participants for a given photo as list projections. */
  async getParticipantsByPhoto(photoId: string): Promise<ParticipantListProjection[]> {
    const records = await this.prisma.detectedParticipant.findMany({
      where: { photo_id: photoId },
      select: ParticipantMapper.participantListSelectConfig,
      orderBy: { created_at: 'asc' },
    })

    return records.map(ParticipantMapper.toListProjection)
  }

  /** Retrieves a single participant's detail by ID. */
  async getParticipantDetail(id: string): Promise<ParticipantDetailProjection | null> {
    const record = await this.prisma.detectedParticipant.findFirst({
      where: { id },
      select: ParticipantMapper.participantDetailSelectConfig,
    })

    return record ? ParticipantMapper.toDetailProjection(record) : null
  }

  /** Returns participant categories for a given event type. */
  async getParticipantCategories(
    eventTypeId: number,
  ): Promise<Array<{ id: number; name: string }>> {
    return this.prisma.participantCategory.findMany({
      where: { event_type_id: eventTypeId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  }

  /** Returns gear types for a given event type. */
  async getGearTypes(eventTypeId: number): Promise<Array<{ id: number; name: string }>> {
    return this.prisma.gearType.findMany({
      where: { event_type_id: eventTypeId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  }
}
