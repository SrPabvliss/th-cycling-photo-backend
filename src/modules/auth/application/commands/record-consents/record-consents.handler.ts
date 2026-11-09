import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { POLICY_VERSIONS } from '../../../domain/constants/consent.constants'
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
          policyVersion: POLICY_VERSIONS[type],
          ipAddress: command.ipAddress ?? null,
          userAgent: command.userAgent ?? null,
        }),
      ),
    )
  }
}
