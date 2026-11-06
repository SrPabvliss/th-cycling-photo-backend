import { MailService } from '@mail/application/services/mail.service'
import { Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { JwtService } from '@nestjs/jwt'
import { AppException } from '@shared/domain'
import { compareSync, hashSync } from 'bcryptjs'
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
import { ChangePasswordCommand } from './change-password.command'

const BCRYPT_ROUNDS = 10
const FALLBACK_NAME = 'ciclista'

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  private readonly logger = new Logger(ChangePasswordHandler.name)
  private readonly webBaseUrl: string

  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepo: IAuthUserRepository,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: IRefreshTokenRepository,
    @Inject(TOKEN_HASH_SERVICE) private readonly tokenHashService: ITokenHashService,
    private readonly jwtService: JwtService,
  ) {
    this.webBaseUrl = this.config.getOrThrow<string>('app.webBaseUrl')
  }

  async execute(command: ChangePasswordCommand): Promise<AuthTokensProjection> {
    const user = await this.authUserRepo.findCredentials(command.userId)
    if (!user) throw AppException.businessRule('auth.invalid_credentials')

    if (!user.isActive) throw AppException.businessRule('auth.account_deactivated')

    const currentPasswordValid = compareSync(command.currentPassword, user.passwordHash)
    if (!currentPasswordValid) throw AppException.businessRule('auth.current_password_invalid')

    if (command.newPassword === command.currentPassword) {
      throw AppException.businessRule('auth.password_same_as_current')
    }

    const passwordHash = hashSync(command.newPassword, BCRYPT_ROUNDS)
    await this.authUserRepo.updatePassword(user.id, passwordHash)

    const version = await this.authUserRepo.bumpSessionVersion(user.id)
    const keep = command.refreshToken ? this.tokenHashService.hash(command.refreshToken) : null
    await this.refreshTokenRepo.revokeAllExcept(user.id, keep)
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: command.role,
      pv: version,
    })

    const changedAt = new Date()
    const changedTime = new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(changedAt)
    const changedDate = new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(changedAt)

    await this.notifyPasswordChanged(user.email, user.firstName, changedDate, changedTime)

    return { accessToken }
  }

  private async notifyPasswordChanged(
    email: string,
    firstName: string | null,
    changedDate: string,
    changedTime: string,
  ): Promise<void> {
    try {
      await this.mailService.enqueue({
        to: email,
        subject: `Tu contraseña cambió — ${changedDate}, ${changedTime}`,
        template: 'password-changed',
        vars: {
          firstName: firstName ?? FALLBACK_NAME,
          changedTime,
          changedDate,
          logoUrl: `${this.webBaseUrl}/brand/logo-email.png`,
        },
      })
    } catch (error) {
      this.logger.error(`Password changed for ${email} but the notice could not be queued`, error)
    }
  }
}
