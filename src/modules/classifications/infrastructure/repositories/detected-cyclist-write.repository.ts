import type { DetectedCyclist } from '@classifications/domain/entities'
import type { IDetectedCyclistWriteRepository } from '@classifications/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import * as DetectedCyclistMapper from '../mappers/detected-cyclist.mapper'

@Injectable()
export class DetectedCyclistWriteRepository implements IDetectedCyclistWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a detected cyclist record. */
  async save(cyclist: DetectedCyclist): Promise<DetectedCyclist> {
    const saved = await this.prisma.detectedCyclist.create({
      data: DetectedCyclistMapper.toPersistence(cyclist),
    })

    return DetectedCyclistMapper.toEntity(saved)
  }
}
