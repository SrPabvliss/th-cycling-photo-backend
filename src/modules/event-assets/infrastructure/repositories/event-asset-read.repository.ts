import type { EventAssetType } from '@generated/prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import { type IStorageAdapter, STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import type { EventAssetProjection } from '../../application/projections'
import type { EventAsset } from '../../domain/entities'
import type { IEventAssetReadRepository } from '../../domain/ports'
import * as EventAssetMapper from '../mappers/event-asset.mapper'

@Injectable()
export class EventAssetReadRepository implements IEventAssetReadRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: IStorageAdapter,
  ) {}

  async findByEventAndType(eventId: string, assetType: EventAssetType): Promise<EventAsset | null> {
    const record = await this.prisma.eventAsset.findFirst({
      where: { event_id: eventId, asset_type: assetType },
    })
    return record ? EventAssetMapper.toEntity(record) : null
  }

  async getByEvent(eventId: string): Promise<EventAssetProjection[]> {
    const records = await this.prisma.eventAsset.findMany({
      where: { event_id: eventId },
      select: EventAssetMapper.eventAssetSelectConfig,
      orderBy: { uploaded_at: 'asc' },
    })

    return records.map((r) =>
      EventAssetMapper.toProjection(r, (key) => this.storage.getPublicUrl(key)),
    )
  }
}
