import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CurrentUser, type ICurrentUser } from '@shared/auth'
import { PermissionGuard } from '@shared/authorization/infrastructure/guards/permission.guard'
import { Authenticated } from '@shared/authorization/presentation/decorators/authenticated.decorator'
import { AllowedWhenFrozen } from '@shared/authorization/presentation/decorators/freeze-policy.decorator'
import { RequirePermission } from '@shared/authorization/presentation/decorators/require-permission.decorator'
import type { Request } from 'express'
import { AcceptContractCommand } from '../../application/commands/accept-contract/accept-contract.command'
import { IssueContractCommand } from '../../application/commands/issue-contract/issue-contract.command'
import { IssueContractDto } from '../../application/commands/issue-contract/issue-contract.dto'
import { ResendContractCommand } from '../../application/commands/resend-contract/resend-contract.command'
import { RevokeContractCommand } from '../../application/commands/revoke-contract/revoke-contract.command'
import type { ContractProjection } from '../../application/projections/contract.projection'
import type { ContractOfferProjection } from '../../application/projections/contract-offer.projection'
import { GetContractByTokenQuery } from '../../application/queries/get-contract-by-token/get-contract-by-token.query'
import { GetContractsListQuery } from '../../application/queries/get-contracts-list/get-contracts-list.query'
import { GetMyContractsQuery } from '../../application/queries/get-my-contracts/get-my-contracts.query'

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(PermissionGuard)
@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @RequirePermission('contract.read')
  async getContracts(): Promise<ContractProjection[]> {
    return this.queryBus.execute(new GetContractsListQuery())
  }

  @Post()
  @RequirePermission('contract.issue')
  @AllowedWhenFrozen()
  async issueContract(
    @Body() dto: IssueContractDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<{ id: string; url: string }> {
    return this.commandBus.execute(
      new IssueContractCommand(
        dto.ownerEmail,
        dto.commercialName,
        dto.eventsTotal,
        dto.photosPerEvent,
        dto.validUntil,
        user.userId,
      ),
    )
  }

  @Post(':id/resend')
  @RequirePermission('contract.issue')
  @AllowedWhenFrozen()
  async resendContract(@Param('id') id: string): Promise<{ url: string }> {
    return this.commandBus.execute(new ResendContractCommand(id))
  }

  @Post(':id/revoke')
  @RequirePermission('contract.revoke')
  @AllowedWhenFrozen()
  async revokeContract(@Param('id') id: string): Promise<void> {
    await this.commandBus.execute(new RevokeContractCommand(id))
  }

  @Get('mine')
  @RequirePermission('tenant.profile.read')
  async getMyContracts(@CurrentUser() user: ICurrentUser): Promise<ContractProjection[]> {
    return this.queryBus.execute(new GetMyContractsQuery(user.userId))
  }

  @Get('token/:token')
  @Authenticated()
  async getContractByToken(
    @Param('token') token: string,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ContractOfferProjection> {
    return this.queryBus.execute(new GetContractByTokenQuery(token, user.userId))
  }

  @Post('token/:token/accept')
  @Authenticated()
  @AllowedWhenFrozen()
  async acceptContract(
    @Param('token') token: string,
    @CurrentUser() user: ICurrentUser,
    @Req() req: Request,
  ): Promise<{ tenantId: string }> {
    return this.commandBus.execute(
      new AcceptContractCommand(
        token,
        user.userId,
        req.ip ?? null,
        req.headers['user-agent'] ?? null,
      ),
    )
  }
}
