import * as crypto from 'node:crypto'
import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type { IRefreshTokenRepository } from '../../../domain/ports'
import { REFRESH_TOKEN_REPOSITORY } from '../../../domain/ports'
import { LogoutCommand } from './logout.command'

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: IRefreshTokenRepository,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(command.refreshToken).digest('hex')
    await this.refreshTokenRepo.revokeByHash(tokenHash)
  }
}
