import { MailService } from '@mail/application/services/mail.service'
import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'
import {
  CONTRACT_REPOSITORY,
  type IContractRepository,
} from '../../../domain/ports/contract-repository.port'
import { type ContactReason, SendContactRequestCommand } from './send-contact-request.command'

const REASON_LABELS: Record<ContactReason, string> = {
  more_quota: 'Más cupo de eventos',
  renewal: 'Renovación del contrato',
}

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

@CommandHandler(SendContactRequestCommand)
export class SendContactRequestHandler implements ICommandHandler<SendContactRequestCommand> {
  constructor(
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
    @Inject(CONTRACT_REPOSITORY) private readonly contractRepo: IContractRepository,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async execute(command: SendContactRequestCommand): Promise<{ sent: true }> {
    const user = await this.userRepo.findById(command.userId)
    if (!user) throw AppException.notFound('entities.user', command.userId)

    const tenantId = await this.userRepo.findTenantId(command.userId)
    if (!tenantId) throw AppException.forbidden('tenant.not_a_tenant_member')

    const usable = await this.contractRepo.findNextUsable(tenantId)
    const latest = usable ?? (await this.contractRepo.findMostRecentAccepted(tenantId))
    const isCurrent = latest !== null && latest.contract.validUntil.getTime() >= Date.now()

    const organizerName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email
    const webBaseUrl = this.config.getOrThrow<string>('app.webBaseUrl')
    const shared = {
      reasonLabel: REASON_LABELS[command.reason],
      eventsWanted: command.eventsWanted ? String(command.eventsWanted) : '—',
      message: command.message,
      logoUrl: `${webBaseUrl}/brand/logo-email.png`,
    }

    await this.mailService.enqueue({
      to: this.config.getOrThrow<string>('mail.contactInbox'),
      replyTo: user.email,
      subject: `${shared.reasonLabel} — ${organizerName}`,
      template: 'tenant-contact-request',
      vars: {
        ...shared,
        organizerName,
        organizerEmail: user.email,
        tenantId,
        contractStatus: isCurrent ? 'Vigente' : 'Sin contrato vigente',
        contractName: latest?.contract.commercialName ?? '',
        eventsUsed: latest ? String(latest.eventsUsed) : '',
        eventsTotal: latest ? String(latest.contract.eventsTotal) : '',
        validUntil: latest ? formatDate(latest.contract.validUntil) : '',
      },
    })

    await this.mailService.enqueue({
      to: user.email,
      subject: 'Recibimos tu mensaje para Titan TV',
      template: 'tenant-contact-confirmation',
      vars: { ...shared, firstName: user.firstName ?? organizerName },
    })

    return { sent: true }
  }
}
