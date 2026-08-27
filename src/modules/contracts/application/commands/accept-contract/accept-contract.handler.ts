import { AUTH_USER_REPOSITORY, type IAuthUserRepository } from '@auth/domain/ports'
import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { NotificationsService } from '@notifications/application/services/notifications.service'
import { AppException } from '@shared/domain'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import { hashContractToken } from '../../../domain/hash-contract-token'
import {
  CONTRACT_REPOSITORY,
  type IContractRepository,
} from '../../../domain/ports/contract-repository.port'
import { AcceptContractCommand } from './accept-contract.command'

@CommandHandler(AcceptContractCommand)
export class AcceptContractHandler implements ICommandHandler<AcceptContractCommand> {
  private readonly logger = new Logger(AcceptContractHandler.name)

  constructor(
    @Inject(CONTRACT_REPOSITORY) private readonly contractRepo: IContractRepository,
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    @Inject(USER_READ_REPOSITORY) private readonly userReadRepo: IUserReadRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async execute(command: AcceptContractCommand): Promise<{ tenantId: string }> {
    const owner = await this.userReadRepo.findById(command.userId)
    if (!owner?.isActive) {
      throw AppException.businessRule('contract.owner_inactive')
    }

    const tokenHash = hashContractToken(command.token)
    const contract = await this.contractRepo.findByTokenHash(tokenHash)
    if (!contract) throw AppException.notFound('entities.tenant_contract', command.token)

    const me = await this.authUserRepo.getMe(command.userId)
    const emailVerified = me?.emailVerified ?? false

    contract.assertAcceptableBy(command.userId, emailVerified, new Date())

    const result = await this.contractRepo.acceptInTransaction({
      contractId: contract.id,
      userId: command.userId,
      ip: command.ip,
      userAgent: command.userAgent,
      termsVersion: contract.termsVersion,
      commercialName: contract.commercialName,
    })

    this.notifyAdmins(contract.id, contract.commercialName, result.tenantCreated, command.userId)

    return { tenantId: result.tenantId }
  }

  private notifyAdmins(
    contractId: string,
    commercialName: string,
    tenantCreated: boolean,
    acceptedBy: string,
  ): void {
    try {
      this.notificationsService.emitTenantContractAccepted({
        contractId,
        commercialName,
        tenantCreated,
        acceptedBy,
      })
    } catch (error) {
      this.logger.error(
        `Contract ${contractId} accepted but admin notification could not be queued`,
        error,
      )
    }
  }
}
