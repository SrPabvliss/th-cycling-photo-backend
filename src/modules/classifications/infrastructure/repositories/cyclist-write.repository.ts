import type { DetectedCyclist, EquipmentColor, PlateNumber } from '@classifications/domain/entities'
import type { ICyclistWriteRepository } from '@classifications/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import * as CyclistMapper from '../mappers/cyclist.mapper'

@Injectable()
export class CyclistWriteRepository implements ICyclistWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates or updates a detected cyclist record. */
  async saveCyclist(cyclist: DetectedCyclist): Promise<DetectedCyclist> {
    const data = CyclistMapper.toCyclistPersistence(cyclist)
    const saved = await this.prisma.detectedCyclist.upsert({
      where: { id: cyclist.id },
      create: data,
      update: data,
    })
    return CyclistMapper.toEntity(saved)
  }

  /** Creates or updates a plate number record. */
  async savePlateNumber(plate: PlateNumber): Promise<PlateNumber> {
    const data = CyclistMapper.toPlatePersistence(plate)
    const saved = await this.prisma.plateNumber.upsert({
      where: { id: plate.id },
      create: data,
      update: data,
    })
    return CyclistMapper.toPlateEntity(saved)
  }

  /** Saves a batch of equipment colors. */
  async saveColors(colors: EquipmentColor[]): Promise<void> {
    if (colors.length === 0) return
    await this.prisma.equipmentColor.createMany({
      data: colors.map(CyclistMapper.toColorPersistence),
    })
  }

  /** Deletes all equipment colors for a given cyclist. */
  async deleteColorsByCyclist(cyclistId: string): Promise<void> {
    await this.prisma.equipmentColor.deleteMany({
      where: { detected_cyclist_id: cyclistId },
    })
  }

  /** Deletes the plate number for a given cyclist. */
  async deletePlateNumberByCyclist(cyclistId: string): Promise<void> {
    await this.prisma.plateNumber.deleteMany({
      where: { detected_cyclist_id: cyclistId },
    })
  }

  /** Deletes a cyclist and all related records (cascade). */
  async deleteCyclist(id: string): Promise<void> {
    await this.prisma.detectedCyclist.delete({ where: { id } })
  }
}
