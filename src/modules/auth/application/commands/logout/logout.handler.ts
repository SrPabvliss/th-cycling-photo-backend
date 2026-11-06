import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type {
  IAuthUserRepository,
  IRefreshTokenRepository,
  ITokenHashService,
} from '../../../domain/ports'
import {
  AUTH_USER_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  TOKEN_HASH_SERVICE,
} from '../../../domain/ports'
import { LogoutCommand } from './logout.command'

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: IRefreshTokenRepository,
    @Inject(TOKEN_HASH_SERVICE) private readonly tokenHashService: ITokenHashService,
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    const tokenHash = this.tokenHashService.hash(command.refreshToken)
    const stored = await this.refreshTokenRepo.findByHash(tokenHash)
    await this.refreshTokenRepo.revokeByHash(tokenHash)
    if (stored && !stored.revokedAt) await this.authUserRepo.bumpSessionVersion(stored.userId)
  }
}
