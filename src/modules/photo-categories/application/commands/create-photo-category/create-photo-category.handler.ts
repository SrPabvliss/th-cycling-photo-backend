import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { EntityIdProjection } from '@shared/application'
import {
  AUTHORIZATION_SERVICE,
  type IAuthorizationService,
} from '@shared/authorization/domain/ports/authorization.service.port'
import { AppException } from '@shared/domain'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import { PhotoCategory } from '../../../domain/entities'
import {
  type IPhotoCategoryReadRepository,
  type IPhotoCategoryWriteRepository,
  PHOTO_CATEGORY_READ_REPOSITORY,
  PHOTO_CATEGORY_WRITE_REPOSITORY,
} from '../../../domain/ports'
import { CreatePhotoCategoryCommand } from './create-photo-category.command'

/**
 * A base category belongs to nobody and needs `photo_category.base.manage`; otherwise the category
 * is the caller's tenant's own. Either way its name may not clash with a base category or, for an
 * own one, with that tenant's other categories.
 */
@CommandHandler(CreatePhotoCategoryCommand)
export class CreatePhotoCategoryHandler implements ICommandHandler<CreatePhotoCategoryCommand> {
  constructor(
    @Inject(PHOTO_CATEGORY_READ_REPOSITORY) private readonly readRepo: IPhotoCategoryReadRepository,
    @Inject(PHOTO_CATEGORY_WRITE_REPOSITORY)
    private readonly writeRepo: IPhotoCategoryWriteRepository,
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
    @Inject(AUTHORIZATION_SERVICE) private readonly authz: IAuthorizationService,
  ) {}

  async execute(command: CreatePhotoCategoryCommand): Promise<EntityIdProjection> {
    let tenantId: string | null = null
    if (command.base) {
      await this.authz.assert(command.userId, 'photo_category.base.manage')
    } else {
      tenantId = await this.userRepo.findTenantId(command.userId)
      if (!tenantId) throw AppException.forbidden('photo_category.tenant_required')
    }

    if (await this.readRepo.findClashing(command.name, tenantId)) {
      throw AppException.conflict('photo_category.name_taken')
    }

    const saved = await this.writeRepo.save(PhotoCategory.create({ name: command.name, tenantId }))
    return { id: String(saved.id) }
  }
}
