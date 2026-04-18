import { Injectable } from '@nestjs/common'
import type { PreviewLink } from '@previews/domain/entities'
import type { IPreviewLinkWriteRepository } from '@previews/domain/ports'
import { PrismaService } from '@shared/infrastructure'
import * as PreviewLinkMapper from '../mappers/preview-link.mapper'

@Injectable()
export class PreviewLinkWriteRepository implements IPreviewLinkWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Persists a preview link entity (create or update). */
  async save(previewLink: PreviewLink): Promise<PreviewLink> {
    const data = PreviewLinkMapper.toPersistence(previewLink)

    const saved = await this.prisma.previewLink.upsert({
      where: { id: previewLink.id },
      create: data,
      update: data,
    })

    return PreviewLinkMapper.toEntity(saved)
  }

  /** Creates photo associations for a preview link. */
  async savePhotos(previewLinkId: string, photoIds: string[]): Promise<void> {
    await this.prisma.previewLinkPhoto.createMany({
      data: photoIds.map((photoId) => ({
        preview_link_id: previewLinkId,
        photo_id: photoId,
      })),
      skipDuplicates: true,
    })
  }
}
