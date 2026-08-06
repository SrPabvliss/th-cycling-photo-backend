import { MailService } from '@mail/application/services/mail.service'
import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { hashSync } from 'bcryptjs'
import type {
  IPasswordResetTokenRepository,
  IPasswordResetTokenService,
} from '../../../domain/ports'
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  PASSWORD_RESET_TOKEN_SERVICE,
} from '../../../domain/ports'
import { ConfirmPasswordResetCommand } from './confirm-password-reset.command'

const BCRYPT_ROUNDS = 10
const FALLBACK_NAME = 'ciclista'

@CommandHandler(ConfirmPasswordResetCommand)
export class ConfirmPasswordResetHandler implements ICommandHandler<ConfirmPasswordResetCommand> {
  private readonly webBaseUrl: string

  constructor(
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokenRepo: IPasswordResetTokenRepository,
    @Inject(PASSWORD_RESET_TOKEN_SERVICE)
    private readonly tokenService: IPasswordResetTokenService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {
    this.webBaseUrl = this.config.getOrThrow<string>('app.webBaseUrl')
  }

  async execute(command: ConfirmPasswordResetCommand): Promise<void> {
    const parsed = this.tokenService.parse(command.token)
    if (!parsed) throw AppException.businessRule('auth.reset_token_invalid')

    const stored = await this.tokenRepo.findById(parsed.id)
    if (!stored) throw AppException.businessRule('auth.reset_token_invalid')
    if (!this.tokenService.matches(parsed.secret, stored.tokenHash)) {
      throw AppException.businessRule('auth.reset_token_invalid')
    }
    if (stored.usedAt) throw AppException.businessRule('auth.reset_token_used')
    if (stored.expiresAt < new Date()) throw AppException.businessRule('auth.reset_token_expired')
    if (!stored.isActive) throw AppException.businessRule('auth.account_deactivated')

    const passwordHash = hashSync(command.password, BCRYPT_ROUNDS)
    const consumed = await this.tokenRepo.consumeAndUpdatePassword(
      stored.id,
      stored.userId,
      passwordHash,
    )
    if (!consumed) throw AppException.businessRule('auth.reset_token_used')

    const changedAt = new Date()
    const changedTime = new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(changedAt)
    const changedDate = new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(changedAt)

    await this.mailService.enqueue({
      to: stored.email,
      subject: `Tu contraseña cambió — ${changedDate}, ${changedTime}`,
      template: 'password-changed',
      vars: {
        firstName: stored.firstName ?? FALLBACK_NAME,
        changedTime,
        changedDate,
        logoUrl: `${this.webBaseUrl}/brand/logo-email.png`,
      },
    })
  }
}
