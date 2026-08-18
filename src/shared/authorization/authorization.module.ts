import { Global, Module } from '@nestjs/common'
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module'
import { AUTHORIZATION_SERVICE } from './domain/ports/authorization.service.port'
import { AUTHORIZATION_CACHE } from './domain/ports/authorization-cache.port'
import { PERMISSION_REPOSITORY } from './domain/ports/permission-repository.port'
import { AuthorizationService } from './infrastructure/authorization.service'
import { RequestScopedAuthorizationCache } from './infrastructure/cache/request-scoped-authorization.cache'
import { PermissionRepository } from './infrastructure/repositories/permission.repository'

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    { provide: PERMISSION_REPOSITORY, useClass: PermissionRepository },
    { provide: AUTHORIZATION_CACHE, useClass: RequestScopedAuthorizationCache },
    { provide: AUTHORIZATION_SERVICE, useClass: AuthorizationService },
  ],
  exports: [AUTHORIZATION_SERVICE, AUTHORIZATION_CACHE, PERMISSION_REPOSITORY],
})
export class AuthorizationModule {}
