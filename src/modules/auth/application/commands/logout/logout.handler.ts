import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { IRefreshTokenRepository, ITokenHashService } from '../../../domain/ports'
import { REFRESH_TOKEN_REPOSITORY, TOKEN_HASH_SERVICE } from '../../../domain/ports'
import { LogoutCommand } from './logout.command'

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: IRefreshTokenRepository,
    @Inject(TOKEN_HASH_SERVICE) private readonly tokenHashService: ITokenHashService,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    const tokenHash = this.tokenHashService.hash(command.refreshToken)
    await this.refreshTokenRepo.revokeByHash(tokenHash)
  }
}
