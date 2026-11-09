import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { EntityIdProjection } from '@shared/application'
import {
  ConfirmPassword,
  CurrentUser,
  type ICurrentUser,
  PasswordConfirmationGuard,
} from '@shared/auth'
import { PermissionGuard } from '@shared/authorization/infrastructure/guards/permission.guard'
import { RequirePermission } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import { AppException } from '@shared/domain'
import { ConfirmWatermarkUploadCommand } from '../../application/commands/confirm-watermark-upload/confirm-watermark-upload.command'
import { CreatePayoutMethodCommand } from '../../application/commands/create-payout-method/create-payout-method.command'
import { DeletePayoutMethodCommand } from '../../application/commands/delete-payout-method/delete-payout-method.command'
import { GenerateWatermarkPresignedUrlCommand } from '../../application/commands/generate-watermark-presigned-url/generate-watermark-presigned-url.command'
import { UpdateMyTenantProfileCommand } from '../../application/commands/update-my-tenant-profile/update-my-tenant-profile.command'
import { UpdatePayoutMethodCommand } from '../../application/commands/update-payout-method/update-payout-method.command'
import type { PayoutMethodProjection } from '../../application/projections/payout-method.projection'
import type { TenantProfileProjection } from '../../application/projections/tenant-profile.projection'
import { GetMyPayoutMethodsQuery } from '../../application/queries/get-my-payout-methods/get-my-payout-methods.query'
import { GetMyTenantProfileQuery } from '../../application/queries/get-my-tenant-profile/get-my-tenant-profile.query'
import { VerifyPayoutReceiverQuery } from '../../application/queries/verify-payout-receiver/verify-payout-receiver.query'
import type { BankTransferDetails } from '../../domain/entities/tenant-payout-method.entity'
import {
  ConfirmPasswordDto,
  CreatePayoutMethodDto,
  UpdatePayoutMethodDto,
  UpdatePayoutMethodSortOrderDto,
  VerifyReceiverDto,
  VerifyReceiverProjection,
} from '../dtos/payout-method.dto'
import { UpdateTenantProfileDto } from '../dtos/update-tenant-profile.dto'
import {
  ConfirmWatermarkUploadDto,
  GenerateWatermarkPresignedUrlDto,
} from '../dtos/watermark-upload.dto'

function toBankDetails(dto: {
  bankName?: string
  accountNumber?: string
  accountType?: string
  accountHolder?: string
  holderIdentification?: string
}): BankTransferDetails | null {
  if (
    !dto.bankName ||
    !dto.accountNumber ||
    !dto.accountType ||
    !dto.accountHolder ||
    !dto.holderIdentification
  ) {
    return null
  }
  return {
    bankName: dto.bankName,
    accountNumber: dto.accountNumber,
    accountType: dto.accountType,
    accountHolder: dto.accountHolder,
    holderIdentification: dto.holderIdentification,
  }
}

function toBankDetailsOrUndefined(dto: {
  bankName?: string
  accountNumber?: string
  accountType?: string
  accountHolder?: string
  holderIdentification?: string
}): BankTransferDetails | undefined {
  const anyBankField =
    dto.bankName !== undefined ||
    dto.accountNumber !== undefined ||
    dto.accountType !== undefined ||
    dto.accountHolder !== undefined ||
    dto.holderIdentification !== undefined
  if (!anyBankField) return undefined
  const bank = toBankDetails(dto)
  if (!bank) throw AppException.businessRule('payment.invalid_bank_details')
  return bank
}

@ApiTags('Tenant Profile')
@ApiBearerAuth()
@UseGuards(PermissionGuard, PasswordConfirmationGuard)
@Controller('tenants/me')
export class TenantProfileController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('profile')
  @RequirePermission('tenant.profile.read')
  async getProfile(@CurrentUser() user: ICurrentUser): Promise<TenantProfileProjection> {
    return this.queryBus.execute(new GetMyTenantProfileQuery(user.userId))
  }

  @Patch('profile')
  @RequirePermission('tenant.profile.update')
  async updateProfile(
    @Body() dto: UpdateTenantProfileDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new UpdateMyTenantProfileCommand(user.userId, dto.publicName, dto.whatsappNumber),
    )
  }

  @Post('watermark/presigned-url')
  @RequirePermission('tenant.profile.update')
  async presignWatermark(
    @Body() dto: GenerateWatermarkPresignedUrlDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.commandBus.execute(
      new GenerateWatermarkPresignedUrlCommand(user.userId, dto.fileName, dto.contentType),
    )
  }

  @Post('watermark/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('tenant.profile.update')
  async confirmWatermark(
    @Body() dto: ConfirmWatermarkUploadDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<void> {
    await this.commandBus.execute(new ConfirmWatermarkUploadCommand(user.userId, dto.storageKey))
  }

  @Get('payout-methods')
  @RequirePermission('tenant.payout_method.read')
  async getPayoutMethods(@CurrentUser() user: ICurrentUser): Promise<PayoutMethodProjection[]> {
    return this.queryBus.execute(new GetMyPayoutMethodsQuery(user.userId))
  }

  @Post('payout-methods/verify-receiver')
  @RequirePermission('tenant.payout_method.manage')
  async verifyPayoutReceiver(
    @Body() dto: VerifyReceiverDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<VerifyReceiverProjection> {
    return this.queryBus.execute(new VerifyPayoutReceiverQuery(user.userId, dto.phone))
  }

  @Post('payout-methods')
  @RequirePermission('tenant.payout_method.manage')
  @ConfirmPassword()
  @Throttle({ short: { limit: 10, ttl: 900000 } })
  async createPayoutMethod(
    @Body() dto: CreatePayoutMethodDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<EntityIdProjection> {
    return this.commandBus.execute(
      new CreatePayoutMethodCommand(
        user.userId,
        dto.provider,
        dto.phone ?? null,
        toBankDetails(dto),
      ),
    )
  }

  @Patch('payout-methods/:id')
  @RequirePermission('tenant.payout_method.manage')
  @ConfirmPassword()
  @Throttle({ short: { limit: 10, ttl: 900000 } })
  async updatePayoutMethod(
    @Param('id') id: string,
    @Body() dto: UpdatePayoutMethodDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new UpdatePayoutMethodCommand(
        user.userId,
        id,
        dto.phone,
        toBankDetailsOrUndefined(dto),
        dto.isActive,
        undefined,
      ),
    )
  }

  @Patch('payout-methods/:id/sort-order')
  @RequirePermission('tenant.payout_method.manage')
  async updatePayoutMethodSortOrder(
    @Param('id') id: string,
    @Body() dto: UpdatePayoutMethodSortOrderDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new UpdatePayoutMethodCommand(
        user.userId,
        id,
        undefined,
        undefined,
        undefined,
        dto.sortOrder,
      ),
    )
  }

  @Delete('payout-methods/:id')
  @RequirePermission('tenant.payout_method.manage')
  @ConfirmPassword()
  @Throttle({ short: { limit: 10, ttl: 900000 } })
  async deletePayoutMethod(
    @Param('id') id: string,
    @Body() _dto: ConfirmPasswordDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<void> {
    await this.commandBus.execute(new DeletePayoutMethodCommand(user.userId, id))
  }
}
