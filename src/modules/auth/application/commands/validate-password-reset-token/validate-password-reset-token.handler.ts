import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type {
  IPasswordResetTokenRepository,
  IPasswordResetTokenService,
} from '../../../domain/ports'
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  PASSWORD_RESET_TOKEN_SERVICE,
} from '../../../domain/ports'
import type { PasswordResetTokenValidityProjection } from '../../projections'
import { ValidatePasswordResetTokenCommand } from './validate-password-reset-token.command'

@CommandHandler(ValidatePasswordResetTokenCommand)
export class ValidatePasswordResetTokenHandler
  implements ICommandHandler<ValidatePasswordResetTokenCommand>
{
  constructor(
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokenRepo: IPasswordResetTokenRepository,
    @Inject(PASSWORD_RESET_TOKEN_SERVICE)
    private readonly tokenService: IPasswordResetTokenService,
  ) {}

  async execute(
    command: ValidatePasswordResetTokenCommand,
  ): Promise<PasswordResetTokenValidityProjection> {
    const parsed = this.tokenService.parse(command.token)
    if (!parsed) return { valid: false }

    const stored = await this.tokenRepo.findById(parsed.id)
    if (!stored) return { valid: false }
    if (!this.tokenService.matches(parsed.secret, stored.tokenHash)) return { valid: false }
    if (stored.usedAt) return { valid: false }
    if (stored.expiresAt < new Date()) return { valid: false }
    if (!stored.isActive) return { valid: false }

    return { valid: true }
  }
}
