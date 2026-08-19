import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { PermissionGuard } from '@shared/authorization/infrastructure/guards/permission.guard'
import { RequirePermission } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import { hashSync } from 'bcryptjs'
import { CreateTenantCommand } from '../../application/commands/create-tenant/create-tenant.command'
import { UpdateTenantQuotaCommand } from '../../application/commands/update-tenant-quota/update-tenant-quota.command'
import { GetTenantsListQuery } from '../../application/queries/get-tenants-list/get-tenants-list.query'
import type { TenantListProjection } from '../../domain/ports/tenant-repository.port'
import { CreateTenantDto } from '../../presentation/dtos/create-tenant.dto'
import { UpdateTenantQuotaDto } from '../../presentation/dtos/update-tenant-quota.dto'

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(PermissionGuard)
@Controller('api/v1/tenants')
export class TenantsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @RequirePermission('tenant.read')
  async getTenants(): Promise<TenantListProjection[]> {
    return this.queryBus.execute(new GetTenantsListQuery())
  }

  @Post()
  @RequirePermission('tenant.create')
  async createTenant(@Body() dto: CreateTenantDto): Promise<{ id: string }> {
    const passwordHash = hashSync(dto.adminPassword, 10)
    const id = await this.commandBus.execute(
      new CreateTenantCommand(
        dto.name,
        dto.eventQuota,
        dto.adminEmail,
        passwordHash,
        dto.adminFirstName,
        dto.adminLastName,
      ),
    )
    return { id }
  }

  @Patch(':id/quota')
  @RequirePermission('tenant.quota.set')
  async updateQuota(@Param('id') id: string, @Body() dto: UpdateTenantQuotaDto): Promise<void> {
    await this.commandBus.execute(new UpdateTenantQuotaCommand(id, dto.quota))
  }
}
