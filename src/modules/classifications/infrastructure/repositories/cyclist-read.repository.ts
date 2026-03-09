import type {
  CyclistDetailProjection,
  CyclistListProjection,
} from '@classifications/application/projections'
import type { DetectedCyclist } from '@classifications/domain/entities'
import type { ICyclistReadRepository } from '@classifications/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import { CYCLIST_DETAIL_SELECT, CYCLIST_LIST_SELECT } from '../constants'
import * as CyclistMapper from '../mappers/cyclist.mapper'

@Injectable()
export class CyclistReadRepository implements ICyclistReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds a detected cyclist entity by ID. */
  async findById(id: string): Promise<DetectedCyclist | null> {
    const record = await this.prisma.detectedCyclist.findFirst({ where: { id } })
    return record ? CyclistMapper.toEntity(record) : null
  }

  /** Retrieves all cyclists for a given photo as list projections. */
  async getCyclistsByPhoto(photoId: string): Promise<CyclistListProjection[]> {
    const records = await this.prisma.detectedCyclist.findMany({
      where: { photo_id: photoId },
      select: CYCLIST_LIST_SELECT,
      orderBy: { created_at: 'asc' },
    })

    return records.map(CyclistMapper.toListProjection)
  }

  /** Retrieves a single cyclist's detail by ID. */
  async getCyclistDetail(id: string): Promise<CyclistDetailProjection | null> {
    const record = await this.prisma.detectedCyclist.findFirst({
      where: { id },
      select: CYCLIST_DETAIL_SELECT,
    })

    return record ? CyclistMapper.toDetailProjection(record) : null
  }
}
