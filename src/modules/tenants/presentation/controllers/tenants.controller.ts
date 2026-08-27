import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { PermissionGuard } from '@shared/authorization/infrastructure/guards/permission.guard'
import { RequirePermission } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import { UpdateTenantPhotoQuotaDefaultCommand } from '../../application/commands/update-tenant-photo-quota-default/update-tenant-photo-quota-default.command'
import { UpdateTenantPhotoQuotaDefaultDto } from '../dtos/update-tenant-photo-quota-default.dto'

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(PermissionGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch(':id/photo-quota-default')
  @RequirePermission('tenant.quota.set')
  async updatePhotoQuotaDefault(
    @Param('id') id: string,
    @Body() dto: UpdateTenantPhotoQuotaDefaultDto,
  ): Promise<void> {
    await this.commandBus.execute(new UpdateTenantPhotoQuotaDefaultCommand(id, dto.quota))
  }
}
