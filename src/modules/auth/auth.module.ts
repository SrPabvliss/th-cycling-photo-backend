import { LocationsModule } from '@locations/locations.module'
import { MailModule } from '@mail/mail.module'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { CqrsModule } from '@nestjs/cqrs'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfirmPasswordResetHandler } from './application/commands/confirm-password-reset/confirm-password-reset.handler'
import { LoginHandler } from './application/commands/login/login.handler'
import { LogoutHandler } from './application/commands/logout/logout.handler'
import { RecordConsentsHandler } from './application/commands/record-consents/record-consents.handler'
import { RefreshHandler } from './application/commands/refresh/refresh.handler'
import { RegisterHandler } from './application/commands/register/register.handler'
import { RequestPasswordResetHandler } from './application/commands/request-password-reset/request-password-reset.handler'
import { ValidatePasswordResetTokenHandler } from './application/commands/validate-password-reset-token/validate-password-reset-token.handler'
import { GetMeHandler } from './application/queries/me/get-me.handler'
import {
  AUTH_USER_REPOSITORY,
  CONSENT_REPOSITORY,
  PASSWORD_RESET_TOKEN_REPOSITORY,
  PASSWORD_RESET_TOKEN_SERVICE,
  REFRESH_TOKEN_REPOSITORY,
  TOKEN_HASH_SERVICE,
} from './domain/ports'
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard'
import { AuthUserRepository } from './infrastructure/repositories/auth-user.repository'
import { ConsentRepository } from './infrastructure/repositories/consent.repository'
import { PasswordResetTokenRepository } from './infrastructure/repositories/password-reset-token.repository'
import { RefreshTokenRepository } from './infrastructure/repositories/refresh-token.repository'
import { PasswordResetTokenService } from './infrastructure/services/password-reset-token.service'
import { TokenHashService } from './infrastructure/services/token-hash.service'
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy'
import { AuthController } from './presentation/controllers/auth.controller'

const CommandHandlers = [
  LoginHandler,
  RefreshHandler,
  LogoutHandler,
  RegisterHandler,
  RequestPasswordResetHandler,
  ConfirmPasswordResetHandler,
  ValidatePasswordResetTokenHandler,
  RecordConsentsHandler,
]
const QueryHandlers = [GetMeHandler]

@Module({
  imports: [
    CqrsModule,
    PassportModule,
    LocationsModule,
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<number>('jwt.accessExpirationSeconds', 900),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    JwtStrategy,
    JwtAuthGuard,
    { provide: AUTH_USER_REPOSITORY, useClass: AuthUserRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenRepository },
    { provide: TOKEN_HASH_SERVICE, useClass: TokenHashService },
    { provide: PASSWORD_RESET_TOKEN_REPOSITORY, useClass: PasswordResetTokenRepository },
    { provide: PASSWORD_RESET_TOKEN_SERVICE, useClass: PasswordResetTokenService },
    { provide: CONSENT_REPOSITORY, useClass: ConsentRepository },
  ],
  exports: [JwtAuthGuard, JwtModule, AUTH_USER_REPOSITORY],
})
export class AuthModule {}
