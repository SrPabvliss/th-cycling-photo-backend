import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { POLICY_VERSION } from '../../../domain/constants/consent.constants'
import { CONSENT_REPOSITORY, type IConsentRepository } from '../../../domain/ports'
import { RecordConsentsCommand } from './record-consents.command'

@CommandHandler(RecordConsentsCommand)
export class RecordConsentsHandler implements ICommandHandler<RecordConsentsCommand> {
  constructor(@Inject(CONSENT_REPOSITORY) private readonly consentRepo: IConsentRepository) {}

  async execute(command: RecordConsentsCommand): Promise<void> {
    await Promise.all(
      command.types.map((type) =>
        this.consentRepo.record({
          userId: command.userId,
          type,
          policyVersion: POLICY_VERSION,
          ipAddress: command.ipAddress ?? null,
          userAgent: command.userAgent ?? null,
        }),
      ),
    )
  }
}
