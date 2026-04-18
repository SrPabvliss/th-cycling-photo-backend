import { Injectable } from '@nestjs/common'
import type {
  PreviewDataProjection,
  PreviewLinkListProjection,
} from '@previews/application/projections'
import type { PreviewLink } from '@previews/domain/entities'
import type { IPreviewLinkReadRepository } from '@previews/domain/ports'
import { PaginatedResult, type Pagination } from '@shared/application'
import { PrismaService } from '@shared/infrastructure'
import * as PreviewLinkMapper from '../mappers/preview-link.mapper'

@Injectable()
export class PreviewLinkReadRepository implements IPreviewLinkReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds a preview link entity by token. */
  async findByToken(token: string): Promise<PreviewLink | null> {
    const record = await this.prisma.previewLink.findFirst({
      where: { token },
    })
    return record ? PreviewLinkMapper.toEntity(record) : null
  }

  /** Retrieves a paginated list of preview links for an event. */
  async getListByEvent(
    eventId: string,
    pagination: Pagination,
  ): Promise<PaginatedResult<PreviewLinkListProjection>> {
    const where = { event_id: eventId }

    const [previewLinks, total] = await Promise.all([
      this.prisma.previewLink.findMany({
        where,
        select: PreviewLinkMapper.previewLinkListSelectConfig,
        orderBy: { created_at: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.previewLink.count({ where }),
    ])

    return new PaginatedResult(
      previewLinks.map(PreviewLinkMapper.toListProjection),
      total,
      pagination,
    )
  }

  /** Retrieves preview data with photos for a public preview page. */
  async getPreviewData(token: string): Promise<PreviewDataProjection | null> {
    const record = await this.prisma.previewLink.findFirst({
      where: { token },
      select: PreviewLinkMapper.previewDataSelectConfig,
    })

    if (!record) return null

    return PreviewLinkMapper.toPreviewDataProjection(record)
  }
}
