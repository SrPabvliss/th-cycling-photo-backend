import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service'
import type { SimilarPhotoProjection } from '../../projections'
import { FindSimilarPhotosQuery } from './find-similar-photos.query'

interface SimilarPhotoRow {
  id: string
  filename: string
  storage_key: string
  similarity: number
  has_classifications: boolean
}

@QueryHandler(FindSimilarPhotosQuery)
export class FindSimilarPhotosHandler implements IQueryHandler<FindSimilarPhotosQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly photoReadRepo: IPhotoReadRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: FindSimilarPhotosQuery): Promise<SimilarPhotoProjection[]> {
    const photo = await this.photoReadRepo.findById(query.photoId)
    if (!photo) throw AppException.notFound('Photo', query.photoId)

    const embeddingRows = await this.prisma.$queryRawUnsafe<Array<{ embedding: unknown }>>(
      'SELECT "embedding" FROM "photos" WHERE "id" = $1::uuid AND "embedding" IS NOT NULL',
      query.photoId,
    )

    if (embeddingRows.length === 0) return []

    const rows = await this.prisma.$queryRawUnsafe<SimilarPhotoRow[]>(
      `SELECT p.id, p.filename, p.storage_key,
				1 - (p.embedding <=> (SELECT embedding FROM photos WHERE id = $1::uuid)) as similarity,
				EXISTS(SELECT 1 FROM detected_cyclists dc WHERE dc.photo_id = p.id) as has_classifications
			FROM photos p
			WHERE p.event_id = $2::uuid
				AND p.id != $1::uuid
				AND p.embedding IS NOT NULL
			ORDER BY p.embedding <=> (SELECT embedding FROM photos WHERE id = $1::uuid)
			LIMIT $3`,
      query.photoId,
      photo.eventId,
      query.limit,
    )

    return rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      storageKey: row.storage_key,
      similarity: Number(row.similarity),
      hasClassifications: row.has_classifications,
    }))
  }
}
