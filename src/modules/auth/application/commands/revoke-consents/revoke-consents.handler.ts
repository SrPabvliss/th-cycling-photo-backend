import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import { REVOCABLE_CONSENT_TYPES } from '../../../domain/constants/consent.constants'
import { CONSENT_REPOSITORY, type IConsentRepository } from '../../../domain/ports'
import { RevokeConsentsCommand } from './revoke-consents.command'

@CommandHandler(RevokeConsentsCommand)
export class RevokeConsentsHandler implements ICommandHandler<RevokeConsentsCommand> {
  constructor(@Inject(CONSENT_REPOSITORY) private readonly consentRepo: IConsentRepository) {}

  async execute(command: RevokeConsentsCommand): Promise<void> {
    if (command.types.some((type) => !REVOCABLE_CONSENT_TYPES.includes(type))) {
      throw AppException.businessRule('auth.consent_not_revocable')
    }
    await Promise.all(command.types.map((type) => this.consentRepo.revoke(command.userId, type)))
  }
}
