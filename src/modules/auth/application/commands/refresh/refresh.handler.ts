import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { JwtService } from '@nestjs/jwt'
import { AppException } from '@shared/domain'
import type { IRefreshTokenRepository, ITokenHashService } from '../../../domain/ports'
import { REFRESH_TOKEN_REPOSITORY, TOKEN_HASH_SERVICE } from '../../../domain/ports'
import type { AuthTokensProjection } from '../../projections'
import { RefreshCommand } from './refresh.command'

@CommandHandler(RefreshCommand)
export class RefreshHandler implements ICommandHandler<RefreshCommand> {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: IRefreshTokenRepository,
    @Inject(TOKEN_HASH_SERVICE) private readonly tokenHashService: ITokenHashService,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: RefreshCommand): Promise<AuthTokensProjection> {
    const tokenHash = this.tokenHashService.hash(command.refreshToken)

    const storedToken = await this.refreshTokenRepo.findByHash(tokenHash)

    if (!storedToken) throw AppException.businessRule('auth.invalid_refresh_token')
    if (storedToken.revokedAt) throw AppException.businessRule('auth.token_revoked')
    if (storedToken.expiresAt < new Date()) throw AppException.businessRule('auth.token_expired')
    if (!storedToken.isActive) throw AppException.businessRule('auth.account_deactivated')

    const payload = { sub: storedToken.userId, email: storedToken.email, role: storedToken.role }
    const accessToken = this.jwtService.sign(payload)

    return { accessToken }
  }
}
