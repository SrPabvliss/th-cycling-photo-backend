import type { PendingEmailVerificationCodeProjection } from '../../application/projections'
import type { CreateEmailVerificationCodePayload } from '../payloads'

export interface IEmailVerificationCodeRepository {
  create(payload: CreateEmailVerificationCodePayload): Promise<void>
  findLatestUnconsumedByUser(userId: string): Promise<PendingEmailVerificationCodeProjection | null>
  registerAttempt(id: string): Promise<number>
  consume(userId: string): Promise<void>
  countSentSince(userId: string, since: Date): Promise<number>
}

export const EMAIL_VERIFICATION_CODE_REPOSITORY = Symbol('EMAIL_VERIFICATION_CODE_REPOSITORY')
