import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { JwtService } from '@nestjs/jwt'
import { AppException } from '@shared/domain'
import { compareSync } from 'bcryptjs'
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
import type { AuthTokensProjection } from '../../projections'
import { LoginCommand } from './login.command'

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  private readonly refreshExpiryDays: number

  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: IRefreshTokenRepository,
    @Inject(TOKEN_HASH_SERVICE) private readonly tokenHashService: ITokenHashService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.refreshExpiryDays = configService.get<number>('jwt.refreshExpiryDays', 30)
  }

  async execute(
    command: LoginCommand,
  ): Promise<{ tokens: AuthTokensProjection; refreshToken: string }> {
    const user = await this.authUserRepo.findByEmail(command.email)
    if (!user) throw AppException.businessRule('auth.invalid_credentials')

    if (!user.isActive) throw AppException.businessRule('auth.account_deactivated')

    const passwordValid = compareSync(command.password, user.passwordHash)
    if (!passwordValid) throw AppException.businessRule('auth.invalid_credentials')

    const payload = { sub: user.id, email: user.email, role: user.role }
    const accessToken = this.jwtService.sign(payload)

    const rawToken = this.tokenHashService.generateToken()
    const tokenHash = this.tokenHashService.hash(rawToken)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + this.refreshExpiryDays)

    await this.refreshTokenRepo.create({ tokenHash, userId: user.id, expiresAt })
    await this.authUserRepo.updateLastLogin(user.id)

    return {
      tokens: { accessToken },
      refreshToken: rawToken,
    }
  }
}
