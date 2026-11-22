import { LocationValidator } from '@locations/application/services'
import { MailService } from '@mail/application/services/mail.service'
import { Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { JwtService } from '@nestjs/jwt'
import { AppException, isMinorOn, toEcuadorDateOnly } from '@shared/domain'
import { hashSync } from 'bcryptjs'
import {
  CONSENT_TYPE,
  type ConsentType,
  POLICY_VERSIONS,
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
  private readonly webBaseUrl: string

  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: IRefreshTokenRepository,
    @Inject(TOKEN_HASH_SERVICE) private readonly tokenHashService: ITokenHashService,
    @Inject(CONSENT_REPOSITORY) private readonly consentRepo: IConsentRepository,
    private readonly jwtService: JwtService,
    private readonly locationValidator: LocationValidator,
    private readonly mailService: MailService,
    configService: ConfigService,
  ) {
    this.refreshExpiryDays = configService.get<number>('jwt.refreshExpiryDays', 30)
    this.webBaseUrl = configService.getOrThrow<string>('app.webBaseUrl')
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
    const payload = { sub: user.id, email: user.email, role, pv: 0 }
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

    const communityEmails = await this.recordConsents(command, user.id)
    await this.sendWelcome(command, communityEmails)

    return {
      tokens: { accessToken },
      refreshToken: rawToken,
    }
  }

  /** Records the consents given at sign-up. Returns whether community emails were activated. */
  private async recordConsents(command: RegisterCommand, userId: string): Promise<boolean> {
    // Community emails are never activated for a minor, whatever the form sent.
    const birthDate = command.birthDate ? new Date(command.birthDate) : null
    const communityEmails =
      command.communityEmails && !isMinorOn(birthDate, toEcuadorDateOnly(new Date()))
    const types: ConsentType[] = [
      ...(command.acceptedTerms ? [CONSENT_TYPE.TERMS_PRIVACY] : []),
      ...(command.guardianConsent ? [CONSENT_TYPE.GUARDIAN] : []),
      ...(communityEmails ? [CONSENT_TYPE.COMMUNITY_EMAILS] : []),
    ]

    if (types.length === 0) return false

    try {
      await Promise.all(
        types.map((type) =>
          this.consentRepo.record({
            userId,
            type,
            policyVersion: POLICY_VERSIONS[type],
            ipAddress: command.ipAddress,
            userAgent: command.userAgent,
          }),
        ),
      )
      return communityEmails
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to record consents for user ${userId}: ${message}`)
      return false
    }
  }

  /** The welcome email never blocks the sign-up: a queue failure is logged and the account stays. */
  private async sendWelcome(command: RegisterCommand, communityEmails: boolean): Promise<void> {
    try {
      await this.mailService.enqueue({
        to: command.email,
        subject: 'Te damos la bienvenida a Titan TV',
        template: 'welcome',
        vars: {
          firstName: command.firstName,
          eventsUrl: `${this.webBaseUrl}/events`,
          communityEmails: communityEmails ? 'true' : '',
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to enqueue the welcome email: ${message}`)
    }
  }
}
