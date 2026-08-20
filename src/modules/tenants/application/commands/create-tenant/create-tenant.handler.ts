import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { TEMPLATE_KEYS } from '@shared/authorization/domain/permission-template.constants'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import {
  type ITenantRepository,
  TENANT_REPOSITORY,
} from '../../../domain/ports/tenant-repository.port'
import { CreateTenantCommand } from './create-tenant.command'

@CommandHandler(CreateTenantCommand)
export class CreateTenantHandler implements ICommandHandler<CreateTenantCommand> {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly repo: ITenantRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: CreateTenantCommand): Promise<string> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: command.adminEmail },
    })
    if (existingUser) {
      throw AppException.businessRule('tenant.user_email_in_use')
    }

    const template = await this.prisma.permissionTemplate.findUnique({
      where: { key: TEMPLATE_KEYS.TENANT },
    })
    if (!template) {
      throw new Error(`Permission template '${TEMPLATE_KEYS.TENANT}' not found.`)
    }

    return this.repo.createTenantWithAdmin({
      name: command.name,
      eventQuota: command.eventQuota,
      adminEmail: command.adminEmail,
      adminPasswordHash: command.adminPasswordHash,
      adminFirstName: command.adminFirstName,
      adminLastName: command.adminLastName,
      tenantTemplateId: template.id,
    })
  }
}
