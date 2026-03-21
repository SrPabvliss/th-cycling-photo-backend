import { HttpStatus, Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import type { PreviewDataProjection } from '@previews/application/projections'
import { WatermarkUrlService } from '@previews/application/services/watermark-url.service'
import {
  type IPreviewLinkReadRepository,
  type IPreviewLinkWriteRepository,
  PREVIEW_LINK_READ_REPOSITORY,
  PREVIEW_LINK_WRITE_REPOSITORY,
} from '@previews/domain/ports'
import { AppException } from '@shared/domain'
import { GetPreviewByTokenQuery } from './get-preview-by-token.query'

@QueryHandler(GetPreviewByTokenQuery)
export class GetPreviewByTokenHandler implements IQueryHandler<GetPreviewByTokenQuery> {
  constructor(
    @Inject(PREVIEW_LINK_READ_REPOSITORY) private readonly readRepo: IPreviewLinkReadRepository,
    @Inject(PREVIEW_LINK_WRITE_REPOSITORY) private readonly writeRepo: IPreviewLinkWriteRepository,
    private readonly watermarkUrl: WatermarkUrlService,
  ) {}

  async execute(query: GetPreviewByTokenQuery): Promise<PreviewDataProjection> {
    // Find preview link entity
    const previewLink = await this.readRepo.findByToken(query.token)
    if (!previewLink) throw AppException.notFound('entities.preview_link', query.token)

    // Lazy expiration check
    if (previewLink.checkExpiration()) {
      await this.writeRepo.save(previewLink)
      throw new AppException('preview.link_expired', HttpStatus.GONE)
    }

    // Mark as viewed on first access
    if (previewLink.markViewed()) {
      await this.writeRepo.save(previewLink)
    }

    // Get preview data with photos
    const data = await this.readRepo.getPreviewData(query.token)
    if (!data) throw AppException.notFound('entities.preview_link', query.token)

    // Transform photo storage keys to watermarked URLs
    data.photos = data.photos.map((photo) => ({
      id: photo.id,
      url: this.watermarkUrl.buildUrl(photo.url),
    }))

    return data
  }
}
