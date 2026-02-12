import type { PlateNumber } from '@classifications/domain/entities'
import type { IPlateNumberWriteRepository } from '@classifications/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import * as PlateNumberMapper from '../mappers/plate-number.mapper'

@Injectable()
export class PlateNumberWriteRepository implements IPlateNumberWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a plate number record. */
  async save(plateNumber: PlateNumber): Promise<PlateNumber> {
    const saved = await this.prisma.plateNumber.create({
      data: PlateNumberMapper.toPersistence(plateNumber),
    })

    return PlateNumberMapper.toEntity(saved)
  }
}
