import { HttpStatus, Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PreviewDataProjection } from '@previews/application/projections'
import {
  type IPreviewLinkReadRepository,
  type IPreviewLinkWriteRepository,
  PREVIEW_LINK_READ_REPOSITORY,
  PREVIEW_LINK_WRITE_REPOSITORY,
} from '@previews/domain/ports'
import { CdnUrlBuilder } from '@shared/cloudflare/infrastructure'
import { AppException } from '@shared/domain'
import { GetPreviewByTokenQuery } from './get-preview-by-token.query'

@QueryHandler(GetPreviewByTokenQuery)
export class GetPreviewByTokenHandler implements IQueryHandler<GetPreviewByTokenQuery> {
  constructor(
    @Inject(PREVIEW_LINK_READ_REPOSITORY) private readonly readRepo: IPreviewLinkReadRepository,
    @Inject(PREVIEW_LINK_WRITE_REPOSITORY) private readonly writeRepo: IPreviewLinkWriteRepository,
    private readonly cdn: CdnUrlBuilder,
  ) {}

  async execute(query: GetPreviewByTokenQuery): Promise<PreviewDataProjection> {
    const previewLink = await this.readRepo.findByToken(query.token)
    if (!previewLink) throw AppException.notFound('entities.preview_link', query.token)

    if (previewLink.checkExpiration()) {
      await this.writeRepo.save(previewLink)
      throw new AppException('preview.link_expired', HttpStatus.GONE)
    }

    if (previewLink.markViewed()) {
      await this.writeRepo.save(previewLink)
    }

    const data = await this.readRepo.getPreviewData(query.token)
    if (!data) throw AppException.notFound('entities.preview_link', query.token)

    // Build gallery URLs from slugs (watermarked by Worker).
    // Note: the repo returns the slug in `photo.url` — a small legacy quirk.
    data.photos = data.photos.map((photo) => ({
      id: photo.id,
      url: this.cdn.galleryUrl(photo.url),
    }))

    return data
  }
}
