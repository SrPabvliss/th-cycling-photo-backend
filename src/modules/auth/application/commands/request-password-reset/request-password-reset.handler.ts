import { MailService } from '@mail/application/services/mail.service'
import { Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import type {
  IAuthUserRepository,
  IPasswordResetTokenRepository,
  IPasswordResetTokenService,
} from '../../../domain/ports'
import {
  AUTH_USER_REPOSITORY,
  PASSWORD_RESET_TOKEN_REPOSITORY,
  PASSWORD_RESET_TOKEN_SERVICE,
} from '../../../domain/ports'
import { RequestPasswordResetCommand } from './request-password-reset.command'

const RESEND_COOLDOWN_MS = 60_000
const FALLBACK_NAME = 'ciclista'

@CommandHandler(RequestPasswordResetCommand)
export class RequestPasswordResetHandler implements ICommandHandler<RequestPasswordResetCommand> {
  private readonly ttlMinutes: number
  private readonly webBaseUrl: string

  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokenRepo: IPasswordResetTokenRepository,
    @Inject(PASSWORD_RESET_TOKEN_SERVICE)
    private readonly tokenService: IPasswordResetTokenService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {
    this.ttlMinutes = this.config.get<number>('passwordReset.ttlMinutes', 30)
    this.webBaseUrl = this.config.getOrThrow<string>('app.webBaseUrl')
  }

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    const user = await this.authUserRepo.findForPasswordReset(command.email)
    if (!user?.isActive) return

    const lastCreatedAt = await this.tokenRepo.findLastCreatedAtForUser(user.id)
    if (lastCreatedAt && Date.now() - lastCreatedAt.getTime() < RESEND_COOLDOWN_MS) return

    const { id, token, tokenHash } = this.tokenService.generate()

    await this.tokenRepo.create({
      id,
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + this.ttlMinutes * 60_000),
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    })

    await this.mailService.enqueue({
      to: command.email,
      subject: 'Restablece tu contraseña — vence en 30 minutos',
      template: 'password-reset',
      vars: {
        firstName: user.firstName ?? FALLBACK_NAME,
        resetUrl: `${this.webBaseUrl}/reset-password#t=${token}`,
        logoUrl: `${this.webBaseUrl}/brand/logo-email.png`,
      },
    })
  }
}
