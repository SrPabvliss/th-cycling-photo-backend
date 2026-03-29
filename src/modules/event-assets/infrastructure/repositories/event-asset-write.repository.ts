import { Injectable } from '@nestjs/common'
import { PrismaService } from '@shared/infrastructure'
import type { EventAsset } from '../../domain/entities'
import type { IEventAssetWriteRepository } from '../../domain/ports'
import * as EventAssetMapper from '../mappers/event-asset.mapper'

@Injectable()
export class EventAssetWriteRepository implements IEventAssetWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(asset: EventAsset): Promise<EventAsset> {
    const data = EventAssetMapper.toPersistence(asset)

    const saved = await this.prisma.eventAsset.upsert({
      where: {
        event_id_asset_type: {
          event_id: asset.eventId,
          asset_type: asset.assetType,
        },
      },
      create: data,
      update: {
        storage_key: data.storage_key,
        file_size: data.file_size,
        mime_type: data.mime_type,
        uploaded_at: data.uploaded_at,
      },
    })

    return EventAssetMapper.toEntity(saved)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.eventAsset.delete({ where: { id } })
  }
}
