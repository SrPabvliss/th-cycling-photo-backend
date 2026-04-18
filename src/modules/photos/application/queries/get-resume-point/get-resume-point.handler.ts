import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import { GetResumePointQuery } from './get-resume-point.query'

@QueryHandler(GetResumePointQuery)
export class GetResumePointHandler implements IQueryHandler<GetResumePointQuery> {
  constructor(@Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository) {}

  async execute(query: GetResumePointQuery): Promise<{ photoId: string | null; page: number }> {
    return this.readRepo.getResumePoint(query.eventId, query.limit)
  }
}
