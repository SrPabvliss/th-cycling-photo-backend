import type { EquipmentColor } from '@classifications/domain/entities'
import type { IEquipmentColorWriteRepository } from '@classifications/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import * as EquipmentColorMapper from '../mappers/equipment-color.mapper'

@Injectable()
export class EquipmentColorWriteRepository implements IEquipmentColorWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates multiple equipment color records. */
  async saveMany(colors: EquipmentColor[]): Promise<void> {
    if (colors.length === 0) return

    await this.prisma.equipmentColor.createMany({
      data: colors.map(EquipmentColorMapper.toPersistence),
    })
  }
}
