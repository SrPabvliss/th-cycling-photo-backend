import { Inject, Injectable, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { type IUserReadRepository, USER_READ_REPOSITORY } from '@users/domain/ports'

/**
 * Every automatic payment confirmation is audited under a real account, and orders keep it in
 * `confirmed_by_id`. The account is named by email rather than by id: an id differs between
 * environments and drifts silently — a refreshed database replaces the row the local `.env` was
 * pointing at, and the only symptom is a card payment that never settles.
 *
 * Resolving at boot is the point. Without the account there is nothing to audit under, so the
 * application refuses to start instead of taking money it cannot turn into an order.
 */
@Injectable()
export class PaymentSystemActor implements OnModuleInit {
  private resolvedUserId: string | null = null

  constructor(
    @Inject(USER_READ_REPOSITORY) private readonly userRepo: IUserReadRepository,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config.getOrThrow<string>('payments.systemUserEmail')
    const user = await this.userRepo.findByEmail(email)

    if (!user) {
      throw new Error(
        `PAYMENT_SYSTEM_USER_EMAIL is set to ${email}, which is not a user in this database. ` +
          'Card payments would be charged and never settle, so the application will not start.',
      )
    }

    this.resolvedUserId = user.id
  }

  get userId(): string {
    if (!this.resolvedUserId) {
      throw new Error('PaymentSystemActor was read before the module finished starting up')
    }
    return this.resolvedUserId
  }
}
