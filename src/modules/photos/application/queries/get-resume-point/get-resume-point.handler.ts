import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { type IPhotoReadRepository, PHOTO_READ_REPOSITORY } from '@photos/domain/ports'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { GetResumePointQuery } from './get-resume-point.query'

@QueryHandler(GetResumePointQuery)
export class GetResumePointHandler implements IQueryHandler<GetResumePointQuery> {
  constructor(
    @Inject(PHOTO_READ_REPOSITORY) private readonly readRepo: IPhotoReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(query: GetResumePointQuery): Promise<{ photoId: string | null; page: number }> {
    const scope = await this.authz.resolveEventScope(query.userId)
    return this.readRepo.getResumePoint(query.eventId, query.limit, scope)
  }
}
