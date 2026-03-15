import type { DetectedCyclist, EquipmentColor, PlateNumber } from '@classifications/domain/entities'
import type { BulkClassifyInput, ICyclistWriteRepository } from '@classifications/domain/ports'
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

  /** Applies the same classification to multiple photos in a single transaction. */
  async bulkClassify(input: BulkClassifyInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Delete existing classifications for all target photos
      await tx.detectedCyclist.deleteMany({
        where: { photo_id: { in: input.photoIds } },
      })

      // Create new cyclists
      await tx.detectedCyclist.createMany({
        data: input.cyclists.map(CyclistMapper.toCyclistPersistence),
      })

      // Create plate numbers
      if (input.plateNumbers.length > 0) {
        await tx.plateNumber.createMany({
          data: input.plateNumbers.map(CyclistMapper.toPlatePersistence),
        })
      }

      // Create equipment colors
      if (input.colors.length > 0) {
        await tx.equipmentColor.createMany({
          data: input.colors.map(CyclistMapper.toColorPersistence),
        })
      }

      // Mark all photos as classified
      await tx.photo.updateMany({
        where: { id: { in: input.photoIds } },
        data: { classified_at: new Date() },
      })
    })
  }
}
