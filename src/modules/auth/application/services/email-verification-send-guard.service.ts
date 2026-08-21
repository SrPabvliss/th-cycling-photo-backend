import { Inject, Injectable } from '@nestjs/common'
import { AppException } from '@shared/domain'
import {
  EMAIL_VERIFICATION_DAILY_SEND_LIMIT,
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
} from '../../domain/constants/email-verification.constants'
import type { IEmailVerificationCodeRepository } from '../../domain/ports'
import { EMAIL_VERIFICATION_CODE_REPOSITORY } from '../../domain/ports'

@Injectable()
export class EmailVerificationSendGuard {
  constructor(
    @Inject(EMAIL_VERIFICATION_CODE_REPOSITORY)
    private readonly codeRepo: IEmailVerificationCodeRepository,
  ) {}

  async assertCanSend(userId: string): Promise<void> {
    const now = Date.now()

    const recentlySent = await this.codeRepo.countSentSince(
      userId,
      new Date(now - EMAIL_VERIFICATION_RESEND_COOLDOWN_MS),
    )
    if (recentlySent > 0) throw AppException.businessRule('auth.email_verification_cooldown')

    const sentToday = await this.codeRepo.countSentSince(
      userId,
      new Date(now - 24 * 60 * 60 * 1000),
    )
    if (sentToday >= EMAIL_VERIFICATION_DAILY_SEND_LIMIT) {
      throw AppException.businessRule('auth.email_verification_daily_limit')
    }
  }
}
