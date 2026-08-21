import { MailService } from '@mail/application/services/mail.service'
import { Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import {
  EMAIL_VERIFICATION_MAX_ATTEMPTS,
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
import { ConfirmEmailVerificationCommand } from './confirm-email-verification.command'

const FALLBACK_NAME = 'ciclista'

@CommandHandler(ConfirmEmailVerificationCommand)
export class ConfirmEmailVerificationHandler
  implements ICommandHandler<ConfirmEmailVerificationCommand>
{
  private readonly logger = new Logger(ConfirmEmailVerificationHandler.name)
  private readonly webBaseUrl: string

  constructor(
    @Inject(EMAIL_VERIFICATION_CODE_REPOSITORY)
    private readonly codeRepo: IEmailVerificationCodeRepository,
    @Inject(EMAIL_VERIFICATION_CODE_SERVICE)
    private readonly codeService: IEmailVerificationCodeService,
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {
    this.webBaseUrl = this.config.getOrThrow<string>('app.webBaseUrl')
  }

  async execute(command: ConfirmEmailVerificationCommand): Promise<void> {
    const pending = await this.codeRepo.findLatestUnconsumedByUser(command.userId)
    if (!pending) throw AppException.businessRule('auth.email_verification_not_pending')

    if (pending.expiresAt <= new Date()) {
      throw AppException.businessRule('auth.email_verification_expired')
    }

    if (pending.attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
      await this.codeRepo.consume(command.userId)
      throw AppException.businessRule('auth.email_verification_no_attempts_left')
    }

    if (!this.codeService.matches(command.code, pending.codeHash)) {
      const attempts = await this.codeRepo.registerAttempt(pending.id)

      if (attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
        await this.codeRepo.consume(command.userId)
        throw AppException.businessRule('auth.email_verification_no_attempts_left')
      }

      throw AppException.businessRule('auth.email_verification_invalid')
    }

    if (pending.purpose === EMAIL_VERIFICATION_PURPOSE.VERIFY_CURRENT) {
      await this.authUserRepo.markEmailVerified(command.userId)
      await this.codeRepo.consume(command.userId)
      return
    }

    if (pending.purpose === EMAIL_VERIFICATION_PURPOSE.CHANGE_EMAIL) {
      const previousUser = await this.authUserRepo.findCredentials(command.userId)
      if (!previousUser) throw AppException.businessRule('auth.invalid_credentials')
      if (!previousUser.isActive) throw AppException.businessRule('auth.account_deactivated')
      if (previousUser.isProtected) {
        throw AppException.businessRule('auth.email_change_protected_account')
      }

      const targetTaken = await this.authUserRepo.findByEmailExists(pending.targetEmail)
      if (targetTaken) throw AppException.businessRule('auth.email_change_target_taken')

      await this.authUserRepo.applyEmailChange(command.userId, pending.targetEmail)
      await this.codeRepo.consume(command.userId)

      await this.notifyOldAddressOfEmailChange(
        previousUser.email,
        previousUser.firstName,
        pending.targetEmail,
      )
      return
    }

    throw AppException.businessRule('auth.email_verification_invalid')
  }

  private async notifyOldAddressOfEmailChange(
    oldEmail: string,
    firstName: string | null,
    newEmail: string,
  ): Promise<void> {
    try {
      await this.mailService.enqueue({
        to: oldEmail,
        subject: 'El correo de tu cuenta cambió',
        template: 'email-changed-notice',
        vars: {
          firstName: firstName ?? FALLBACK_NAME,
          newEmail,
          logoUrl: `${this.webBaseUrl}/brand/logo-email.png`,
        },
      })
    } catch (error) {
      this.logger.error(`Email changed for ${oldEmail} but the notice could not be queued`, error)
    }
  }
}
