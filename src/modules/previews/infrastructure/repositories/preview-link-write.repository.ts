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

  /** Persists a new preview link and its photo associations atomically. */
  async saveWithPhotos(previewLink: PreviewLink, photoIds: string[]): Promise<PreviewLink> {
    const data = PreviewLinkMapper.toPersistence(previewLink)
    const saved = await this.prisma.$transaction(async (tx) => {
      const link = await tx.previewLink.create({ data })
      await tx.previewLinkPhoto.createMany({
        data: photoIds.map((photoId) => ({ preview_link_id: link.id, photo_id: photoId })),
        skipDuplicates: true,
      })
      return link
    })
    return PreviewLinkMapper.toEntity(saved)
  }
}
