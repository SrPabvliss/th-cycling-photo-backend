import { Injectable } from '@nestjs/common'
import {
  TEMPLATE_KEYS,
  type TemplateKey,
} from '@shared/authorization/domain/permission-template.constants'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import type { User } from '@users/domain/entities'
import type { IUserWriteRepository } from '@users/domain/ports'
import * as UserMapper from '../mappers/user.mapper'

/**
 * TIT-38: the role an admin picks when creating a staff account decides which
 * permission template and tenant the row gets. This mirrors the backfill in
 * `prisma/migrations/20260818140453_tit38_templates/migration.sql` exactly —
 * `admin` → `platform_admin`, `operator` → `platform_staff` — so a user
 * created through `POST /users` is indistinguishable from one the migration
 * converted. Both land on the platform tenant (see the tenant migration's
 * `r.name IN ('admin','operator')` backfill).
 */
const TEMPLATE_FOR_ROLE: Record<string, TemplateKey> = {
  admin: TEMPLATE_KEYS.PLATFORM_ADMIN,
  operator: TEMPLATE_KEYS.PLATFORM_STAFF,
}

@Injectable()
export class UserWriteRepository implements IUserWriteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(user: User, roleName?: string): Promise<User> {
    const data = UserMapper.toPersistence(user)

    // Create and update are split rather than upserted so the authorization
    // assignment can be create-only. `save()` is shared by every user
    // mutation (rename, deactivate, avatar, password reset); re-stamping the
    // template on those would silently undo a later ApplyTemplateCommand.
    const existing = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true },
    })

    if (existing) {
      await this.prisma.user.update({ where: { id: user.id }, data })
    } else {
      const assignment = await this.resolveAuthorizationAssignment(roleName)
      await this.prisma.user.create({ data: { ...data, ...assignment } })
    }

    if (roleName) {
      const saved = await this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { user_roles: true },
      })
      if (saved.user_roles.length === 0) {
        const role = await this.prisma.role.findUnique({
          where: { name: roleName as 'admin' | 'operator' },
        })
        if (role) {
          await this.prisma.userRole.create({
            data: { user_id: saved.id, role_id: role.id },
          })
        }
      }
    }

    const result = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { user_roles: { include: { role: true } } },
    })

    return UserMapper.toEntity(result)
  }

  /**
   * Resolves the template and tenant a newly created staff user must carry.
   *
   * Fails loudly on every branch. A row written with
   * `permission_template_id = NULL` resolves to zero permissions, so every
   * `@RequirePermission` route 403s and event creation throws
   * `event.creator_tenant_required` — and there is no in-product way to fix
   * it, because `ApplyTemplateCommand` has no controller. A 500 at creation
   * time is strictly better than an account that looks created and is not
   * usable.
   */
  private async resolveAuthorizationAssignment(
    roleName?: string,
  ): Promise<{ permission_template_id: string; tenant_id: string }> {
    const templateKey = roleName ? TEMPLATE_FOR_ROLE[roleName] : undefined
    if (!templateKey) {
      throw AppException.internal('authz.unassignable_role', { role: roleName ?? 'none' })
    }

    const template = await this.prisma.permissionTemplate.findUnique({
      where: { key: templateKey },
      select: { id: true },
    })
    if (!template) {
      throw AppException.internal('authz.template_missing', { template: templateKey })
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { is_platform: true },
      select: { id: true },
    })
    if (!tenant) {
      throw AppException.internal('authz.platform_tenant_missing')
    }

    return { permission_template_id: template.id, tenant_id: tenant.id }
  }
}
