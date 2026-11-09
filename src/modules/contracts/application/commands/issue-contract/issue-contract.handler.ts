import { randomBytes } from 'node:crypto'
import { AUTH_USER_REPOSITORY, type IAuthUserRepository } from '@auth/domain/ports'
import { MailService } from '@mail/application/services/mail.service'
import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { TenantContract } from '../../../domain/entities/tenant-contract.entity'
import { hashContractToken } from '../../../domain/hash-contract-token'
import {
  CONTRACT_REPOSITORY,
  type IContractRepository,
} from '../../../domain/ports/contract-repository.port'
import { IssueContractCommand } from './issue-contract.command'

const TOKEN_BYTES = 32
const FALLBACK_NAME = 'organizador'

@CommandHandler(IssueContractCommand)
export class IssueContractHandler implements ICommandHandler<IssueContractCommand> {
  private readonly webBaseUrl: string

  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    @Inject(CONTRACT_REPOSITORY) private readonly contractRepo: IContractRepository,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {
    this.webBaseUrl = this.config.getOrThrow<string>('app.webBaseUrl')
  }

  async execute(command: IssueContractCommand): Promise<{ id: string; url: string }> {
    const owner = await this.authUserRepo.findForPasswordReset(command.ownerEmail)
    if (!owner) throw AppException.businessRule('contract.owner_not_found')
    if (!owner.isActive) throw AppException.businessRule('contract.owner_inactive')

    const pending = await this.contractRepo.findPendingByUserId(owner.id)
    if (pending) throw AppException.businessRule('contract.owner_has_pending_contract')

    const contract = TenantContract.issue({
      userId: owner.id,
      commercialName: command.commercialName,
      eventsTotal: command.eventsTotal,
      photosPerEvent: command.photosPerEvent,
      validUntil: command.validUntil,
      issuedById: command.issuedById,
    })

    const token = randomBytes(TOKEN_BYTES).toString('hex')
    const tokenHash = hashContractToken(token)

    await this.contractRepo.create(contract, tokenHash)

    const url = `${this.webBaseUrl}/contracts/${token}`

    await this.mailService.enqueue({
      to: command.ownerEmail,
      subject: 'Tu contrato de servicio en TitanTV',
      template: 'tenant-contract-invitation',
      vars: {
        firstName: owner.firstName ?? FALLBACK_NAME,
        commercialName: command.commercialName,
        eventsTotal: String(command.eventsTotal),
        photosPerEvent: String(command.photosPerEvent),
        validUntil: command.validUntil.toLocaleDateString('es-EC', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'America/Guayaquil',
        }),
        url,
        logoUrl: `${this.webBaseUrl}/brand/logo-email.png`,
      },
    })

    return { id: contract.id, url }
  }
}
