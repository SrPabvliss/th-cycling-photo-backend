import type { CantonProjection, ProvinceProjection } from '@locations/application/projections'
import type { ILocationReadRepository } from '@locations/domain/ports'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'

@Injectable()
export class LocationReadRepository implements ILocationReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns all provinces sorted alphabetically by name. */
  async findAllProvinces(): Promise<ProvinceProjection[]> {
    const records = await this.prisma.province.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    })
    return records
  }

  /** Returns cantons for a given province, sorted alphabetically. */
  async findCantonsByProvinceId(provinceId: number): Promise<CantonProjection[]> {
    const records = await this.prisma.canton.findMany({
      where: { province_id: provinceId },
      select: { id: true, name: true, province_id: true },
      orderBy: { name: 'asc' },
    })
    return records.map((r) => ({ id: r.id, name: r.name, provinceId: r.province_id }))
  }

  /** Checks if a province exists by ID. */
  async provinceExists(id: number): Promise<boolean> {
    const record = await this.prisma.province.findUnique({
      where: { id },
      select: { id: true },
    })
    return record !== null
  }

  /** Checks if a canton exists and belongs to the given province. */
  async cantonExistsInProvince(cantonId: number, provinceId: number): Promise<boolean> {
    const record = await this.prisma.canton.findFirst({
      where: { id: cantonId, province_id: provinceId },
      select: { id: true },
    })
    return record !== null
  }
}
