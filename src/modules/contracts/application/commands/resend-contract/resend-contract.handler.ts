import { randomBytes } from 'node:crypto'
import { AUTH_USER_REPOSITORY, type IAuthUserRepository } from '@auth/domain/ports'
import { MailService } from '@mail/application/services/mail.service'
import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { hashContractToken } from '../../../domain/hash-contract-token'
import {
  CONTRACT_REPOSITORY,
  type IContractRepository,
} from '../../../domain/ports/contract-repository.port'
import { ResendContractCommand } from './resend-contract.command'

const TOKEN_BYTES = 32
const FALLBACK_NAME = 'organizador'

@CommandHandler(ResendContractCommand)
export class ResendContractHandler implements ICommandHandler<ResendContractCommand> {
  private readonly webBaseUrl: string

  constructor(
    @Inject(CONTRACT_REPOSITORY) private readonly contractRepo: IContractRepository,
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {
    this.webBaseUrl = this.config.getOrThrow<string>('app.webBaseUrl')
  }

  async execute(command: ResendContractCommand): Promise<{ url: string }> {
    const contract = await this.contractRepo.findById(command.id)
    if (!contract) throw AppException.notFound('entities.tenant_contract', command.id)

    contract.assertResendable(new Date())

    const owner = await this.authUserRepo.getMe(contract.userId)
    if (!owner) throw AppException.businessRule('contract.owner_not_found')

    const token = randomBytes(TOKEN_BYTES).toString('hex')
    const tokenHash = hashContractToken(token)

    await this.contractRepo.rotateToken(contract.id, tokenHash)

    const url = `${this.webBaseUrl}/contracts/${token}`

    await this.mailService.enqueue({
      to: owner.email,
      subject: 'Tu contrato de servicio en TitanTV',
      template: 'tenant-contract-invitation',
      vars: {
        firstName: owner.firstName ?? FALLBACK_NAME,
        commercialName: contract.commercialName,
        eventsTotal: String(contract.eventsTotal),
        photosPerEvent: contract.photosPerEvent === null ? '' : String(contract.photosPerEvent),
        validUntil: contract.validUntil.toLocaleDateString('es-EC', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'America/Guayaquil',
        }),
        url,
        logoUrl: `${this.webBaseUrl}/brand/logo-email.png`,
      },
    })

    return { url }
  }
}
