import { LocationValidator } from '@locations/application/services'
import { Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { JwtService } from '@nestjs/jwt'
import { AppException } from '@shared/domain'
import { hashSync } from 'bcryptjs'
import {
  CONSENT_TYPE,
  type ConsentType,
  POLICY_VERSION,
} from '../../../domain/constants/consent.constants'
import {
  AUTH_USER_REPOSITORY,
  CONSENT_REPOSITORY,
  type IAuthUserRepository,
  type IConsentRepository,
  type IRefreshTokenRepository,
  type ITokenHashService,
  REFRESH_TOKEN_REPOSITORY,
  TOKEN_HASH_SERVICE,
} from '../../../domain/ports'
import type { AuthTokensProjection } from '../../projections'
import { RegisterCommand } from './register.command'

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<RegisterCommand> {
  private readonly logger = new Logger(RegisterHandler.name)
  private readonly refreshExpiryDays: number

  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: IRefreshTokenRepository,
    @Inject(TOKEN_HASH_SERVICE) private readonly tokenHashService: ITokenHashService,
    @Inject(CONSENT_REPOSITORY) private readonly consentRepo: IConsentRepository,
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
      birthDate: command.birthDate ? new Date(command.birthDate) : null,
      gender: command.gender,
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

    await this.recordConsents(command, user.id)

    return {
      tokens: { accessToken },
      refreshToken: rawToken,
    }
  }

  private async recordConsents(command: RegisterCommand, userId: string): Promise<void> {
    const types: ConsentType[] = [
      ...(command.acceptedTerms ? [CONSENT_TYPE.TERMS_PRIVACY] : []),
      ...(command.guardianConsent ? [CONSENT_TYPE.GUARDIAN] : []),
    ]

    if (types.length === 0) return

    try {
      await Promise.all(
        types.map((type) =>
          this.consentRepo.record({
            userId,
            type,
            policyVersion: POLICY_VERSION,
            ipAddress: command.ipAddress,
            userAgent: command.userAgent,
          }),
        ),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to record consents for user ${userId}: ${message}`)
    }
  }
}
