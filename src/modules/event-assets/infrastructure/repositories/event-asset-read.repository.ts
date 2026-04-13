import type { EventAssetType } from '@generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { PrismaService } from '@shared/infrastructure'
import type { EventAssetProjection } from '../../application/projections'
import type { EventAsset } from '../../domain/entities'
import type { IEventAssetReadRepository } from '../../domain/ports'
import * as EventAssetMapper from '../mappers/event-asset.mapper'

@Injectable()
export class EventAssetReadRepository implements IEventAssetReadRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cdn: CdnUrlBuilder,
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

    return records.map((r) => EventAssetMapper.toProjection(r, this.cdn.assetUrl(r.public_slug)))
  }
}
