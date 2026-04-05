import { LocationValidator } from '@locations/application/services'
import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { JwtService } from '@nestjs/jwt'
import { AppException } from '@shared/domain'
import { hashSync } from 'bcryptjs'
import {
  AUTH_USER_REPOSITORY,
  type IAuthUserRepository,
  type IRefreshTokenRepository,
  type ITokenHashService,
  REFRESH_TOKEN_REPOSITORY,
  TOKEN_HASH_SERVICE,
} from '../../../domain/ports'
import type { AuthTokensProjection } from '../../projections'
import { RegisterCommand } from './register.command'

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  private readonly refreshExpiryDays: number

  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: IRefreshTokenRepository,
    @Inject(TOKEN_HASH_SERVICE) private readonly tokenHashService: ITokenHashService,
    private readonly jwtService: JwtService,
    private readonly locationValidator: LocationValidator,
    configService: ConfigService,
  ) {
    this.refreshExpiryDays = configService.get<number>('jwt.refreshExpiryDays', 30)
  }

  async execute(
    command: RegisterCommand,
  ): Promise<{ tokens: AuthTokensProjection; refreshToken: string }> {
    const exists = await this.authUserRepo.findByEmailExists(command.email)
    if (exists) throw AppException.conflict('auth.email_already_exists')

    await this.locationValidator.validateFull(
      command.countryId,
      command.provinceId,
      command.cantonId,
    )

    const passwordHash = hashSync(command.password, 10)

    const user = await this.authUserRepo.register({
      email: command.email,
      passwordHash,
      firstName: command.firstName,
      lastName: command.lastName,
      countryId: command.countryId,
      provinceId: command.provinceId,
      cantonId: command.cantonId,
      phoneNumber: command.phoneNumber,
    })

    const role = 'customer'
    const payload = { sub: user.id, email: user.email, role }
    const accessToken = this.jwtService.sign(payload)

    const rawToken = this.tokenHashService.generateToken()
    const tokenHash = this.tokenHashService.hash(rawToken)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + this.refreshExpiryDays)

    await this.refreshTokenRepo.create({
      tokenHash,
      userId: user.id,
      expiresAt,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    })

    return {
      tokens: { accessToken },
      refreshToken: rawToken,
    }
  }
}
