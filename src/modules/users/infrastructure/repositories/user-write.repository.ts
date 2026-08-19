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
 * The role an admin picks decides the new account's template and tenant. Mirrors the backfill in
 * `..._tit38_templates/migration.sql`, so a user created through `POST /users` is
 * indistinguishable from one the migration converted.
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

    // Split rather than upserted so the template assignment stays create-only: `save()` is shared
    // by every user mutation, and re-stamping would silently undo a later ApplyTemplateCommand.
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
   * Resolves the template and tenant a new staff user must carry, failing loudly on every branch:
   * a NULL template resolves to zero permissions, and nothing in the product can repair it since
   * `ApplyTemplateCommand` has no controller. A 500 now beats an account that cannot be used.
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
