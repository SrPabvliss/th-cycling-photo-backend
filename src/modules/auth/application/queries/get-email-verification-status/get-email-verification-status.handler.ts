import { Inject } from '@nestjs/common'
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs'
import { EMAIL_VERIFICATION_MAX_ATTEMPTS } from '../../../domain/constants/email-verification.constants'
import {
  EMAIL_VERIFICATION_CODE_REPOSITORY,
  type IEmailVerificationCodeRepository,
} from '../../../domain/ports'
import type { EmailVerificationStatusProjection } from '../../projections'
import { GetEmailVerificationStatusQuery } from './get-email-verification-status.query'

const VISIBLE_LOCAL_CHARS = 2

const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email

  return `${local.slice(0, VISIBLE_LOCAL_CHARS)}***@${domain}`
}

@QueryHandler(GetEmailVerificationStatusQuery)
export class GetEmailVerificationStatusHandler
  implements IQueryHandler<GetEmailVerificationStatusQuery>
{
  constructor(
    @Inject(EMAIL_VERIFICATION_CODE_REPOSITORY)
    private readonly codeRepo: IEmailVerificationCodeRepository,
  ) {}

  async execute(
    query: GetEmailVerificationStatusQuery,
  ): Promise<EmailVerificationStatusProjection> {
    const pending = await this.codeRepo.findLatestUnconsumedByUser(query.userId)

    if (!pending) {
      return {
        pending: false,
        expired: false,
        purpose: null,
        maskedTargetEmail: null,
        expiresAt: null,
        attemptsRemaining: null,
      }
    }

    const isUsable = pending.expiresAt > new Date()

    return {
      pending: isUsable,
      expired: !isUsable,
      purpose: pending.purpose,
      maskedTargetEmail: maskEmail(pending.targetEmail),
      expiresAt: pending.expiresAt,
      attemptsRemaining: isUsable
        ? Math.max(0, EMAIL_VERIFICATION_MAX_ATTEMPTS - pending.attempts)
        : null,
    }
  }
}
