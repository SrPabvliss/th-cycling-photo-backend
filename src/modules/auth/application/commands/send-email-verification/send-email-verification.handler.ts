import { randomUUID } from 'node:crypto'
import { MailService } from '@mail/application/services/mail.service'
import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import {
  EMAIL_VERIFICATION_CODE_TTL_MINUTES,
  EMAIL_VERIFICATION_PURPOSE,
} from '../../../domain/constants/email-verification.constants'
import type {
  IAuthUserRepository,
  IEmailVerificationCodeRepository,
  IEmailVerificationCodeService,
} from '../../../domain/ports'
import {
  AUTH_USER_REPOSITORY,
  EMAIL_VERIFICATION_CODE_REPOSITORY,
  EMAIL_VERIFICATION_CODE_SERVICE,
} from '../../../domain/ports'
import { EmailVerificationSendGuard } from '../../services'
import { SendEmailVerificationCommand } from './send-email-verification.command'

const FALLBACK_NAME = 'ciclista'

@CommandHandler(SendEmailVerificationCommand)
export class SendEmailVerificationHandler implements ICommandHandler<SendEmailVerificationCommand> {
  private readonly webBaseUrl: string

  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepo: IAuthUserRepository,
    @Inject(EMAIL_VERIFICATION_CODE_REPOSITORY)
    private readonly codeRepo: IEmailVerificationCodeRepository,
    @Inject(EMAIL_VERIFICATION_CODE_SERVICE)
    private readonly codeService: IEmailVerificationCodeService,
    private readonly sendGuard: EmailVerificationSendGuard,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {
    this.webBaseUrl = this.config.getOrThrow<string>('app.webBaseUrl')
  }

  async execute(command: SendEmailVerificationCommand): Promise<void> {
    const user = await this.authUserRepo.findCredentials(command.userId)
    if (!user) throw AppException.businessRule('auth.invalid_credentials')
    if (!user.isActive) throw AppException.businessRule('auth.account_deactivated')

    await this.sendGuard.assertCanSend(command.userId)

    const { code, hash } = this.codeService.generate()

    await this.codeRepo.create({
      id: randomUUID(),
      userId: command.userId,
      purpose: EMAIL_VERIFICATION_PURPOSE.VERIFY_CURRENT,
      targetEmail: user.email,
      codeHash: hash,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_CODE_TTL_MINUTES * 60_000),
    })

    await this.mailService.enqueue({
      to: user.email,
      subject: `Tu código de verificación — vence en ${EMAIL_VERIFICATION_CODE_TTL_MINUTES} minutos`,
      template: 'email-verification-code',
      vars: {
        firstName: user.firstName ?? FALLBACK_NAME,
        code,
        ttlMinutes: String(EMAIL_VERIFICATION_CODE_TTL_MINUTES),
        logoUrl: `${this.webBaseUrl}/brand/logo-email.png`,
      },
    })
  }
}
